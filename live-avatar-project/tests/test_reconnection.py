"""
Tests for WebRTC reconnection handling.

Validates that the avatar system handles network disruptions gracefully
and resumes cleanly after reconnection.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest

from src.agent.state_machine import AvatarState, AvatarStateMachine
from src.avatar.base import AvatarConfig, VideoFrame
from src.avatar.idle_controller import IdleController
from src.streaming.video_publisher import VideoPublisher


def _make_video_frame(index: int = 0) -> VideoFrame:
    """Create a test video frame."""
    return VideoFrame(
        data=np.random.randint(0, 255, (512, 512, 3), dtype=np.uint8),
        width=512,
        height=512,
        timestamp=index / 25.0,
        frame_index=index,
    )


class TestVideoPublisher:
    """Tests for the VideoPublisher."""

    def test_rgb_to_argb_conversion(self) -> None:
        """RGB to ARGB conversion should add alpha channel."""
        rgb = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
        argb = VideoPublisher._rgb_to_argb(rgb)

        assert argb.shape == (100, 100, 4)
        # Alpha channel should be 255 (fully opaque)
        assert np.all(argb[:, :, 0] == 255)
        # RGB channels should match
        np.testing.assert_array_equal(argb[:, :, 1:], rgb)

    @pytest.mark.asyncio
    async def test_frame_queue_backpressure(self) -> None:
        """Publisher should drop old frames when queue is full."""
        publisher = VideoPublisher(queue_size=3)

        # Fill queue
        for i in range(3):
            result = await publisher.push_frame(_make_video_frame(i))
            assert result is True

        # Next push should drop oldest and succeed
        result = await publisher.push_frame(_make_video_frame(3))
        assert result is True
        assert publisher.frames_dropped == 1

    @pytest.mark.asyncio
    async def test_publisher_start_stop(self) -> None:
        """Publisher should start and stop cleanly without errors."""
        publisher = VideoPublisher()
        # Without a room, start/stop should not crash
        # (publish loop handles missing source gracefully)
        await publisher.start()
        assert True  # No exception
        await publisher.stop()


class TestReconnectionScenarios:
    """Tests for reconnection handling."""

    @pytest.mark.asyncio
    async def test_state_machine_force_idle_on_disconnect(self) -> None:
        """State machine should force IDLE when participant disconnects."""
        sm = AvatarStateMachine()

        # Simulate active conversation
        await sm.handle_speech_start()
        await sm.handle_speech_end()
        assert sm.state == AvatarState.THINKING

        # Simulate disconnect
        await sm.force_idle()
        assert sm.state == AvatarState.IDLE

    @pytest.mark.asyncio
    async def test_state_machine_force_idle_from_speaking(self) -> None:
        """Force idle should work from SPEAKING state."""
        sm = AvatarStateMachine()

        await sm.handle_speech_start()
        await sm.handle_speech_end()
        await sm.handle_response_ready()
        assert sm.state == AvatarState.SPEAKING

        await sm.force_idle()
        assert sm.state == AvatarState.IDLE

    @pytest.mark.asyncio
    async def test_state_machine_recovers_after_force_idle(self) -> None:
        """After force idle, normal conversation flow should resume."""
        sm = AvatarStateMachine()

        # First conversation cycle
        await sm.handle_speech_start()
        await sm.handle_speech_end()
        await sm.force_idle()

        # Should be able to start a new cycle
        await sm.handle_speech_start()
        assert sm.state == AvatarState.LISTENING

        await sm.handle_speech_end()
        assert sm.state == AvatarState.THINKING

        await sm.handle_response_ready()
        assert sm.state == AvatarState.SPEAKING

        await sm.handle_response_complete()
        assert sm.state == AvatarState.IDLE

    @pytest.mark.asyncio
    async def test_idle_controller_survives_restart(self) -> None:
        """Idle controller should work after stop/start cycle."""
        engine = MagicMock()
        engine.generate_idle_clips = AsyncMock(
            return_value=[
                [_make_video_frame(i) for i in range(20)]
                for _ in range(3)
            ]
        )

        controller = IdleController(engine=engine, num_clips=3)
        await controller.initialize()

        # First idle session
        controller.start_idle()
        for _ in range(10):
            frame = controller.get_next_frame()
            assert frame is not None
        controller.stop_idle()

        # Second idle session (simulating reconnection)
        controller.start_idle()
        for _ in range(10):
            frame = controller.get_next_frame()
            assert frame is not None
        controller.stop_idle()

    @pytest.mark.asyncio
    async def test_state_callbacks_on_disconnect(self) -> None:
        """State change callbacks should fire on disconnect."""
        sm = AvatarStateMachine()
        transitions: list[tuple[AvatarState, AvatarState]] = []

        def on_change(old: AvatarState, new: AvatarState) -> None:
            transitions.append((old, new))

        sm.on_state_change(on_change)

        await sm.handle_speech_start()
        await sm.force_idle()

        # Should have: IDLE->LISTENING, LISTENING->IDLE
        assert len(transitions) == 2
        assert transitions[-1] == (AvatarState.LISTENING, AvatarState.IDLE)

    @pytest.mark.asyncio
    async def test_invalid_transitions_rejected(self) -> None:
        """Invalid state transitions should return False."""
        sm = AvatarStateMachine()

        # From IDLE, can't go directly to SPEAKING
        result = await sm.transition_to(AvatarState.SPEAKING)
        assert result is False
        assert sm.state == AvatarState.IDLE

        # From IDLE, can't go to THINKING
        result = await sm.transition_to(AvatarState.THINKING)
        assert result is False
