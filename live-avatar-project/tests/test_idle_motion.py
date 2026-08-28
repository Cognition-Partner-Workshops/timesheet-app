"""
Tests for idle motion system.

Validates that the avatar produces continuous natural motion when idle,
never freezes, and transitions smoothly between states.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock

import numpy as np
import pytest

from src.avatar.base import AudioChunk, AvatarConfig, VideoFrame
from src.avatar.idle_controller import IdleController


def _make_video_frame(index: int = 0, width: int = 512, height: int = 512) -> VideoFrame:
    """Create a test video frame with unique pixel data."""
    data = np.random.randint(0, 255, (height, width, 3), dtype=np.uint8)
    return VideoFrame(
        data=data,
        width=width,
        height=height,
        timestamp=index / 25.0,
        frame_index=index,
    )


def _make_idle_clips(num_clips: int = 3, frames_per_clip: int = 50) -> list[list[VideoFrame]]:
    """Create test idle clips."""
    clips = []
    for clip_idx in range(num_clips):
        clip = [
            _make_video_frame(i + clip_idx * frames_per_clip)
            for i in range(frames_per_clip)
        ]
        clips.append(clip)
    return clips


class TestIdleController:
    """Tests for the IdleController."""

    def _create_mock_engine(self) -> MagicMock:
        """Create a mock avatar engine."""
        engine = MagicMock()
        engine.generate_idle_clips = AsyncMock(return_value=_make_idle_clips(3, 50))
        engine.config = AvatarConfig()
        return engine

    @pytest.mark.asyncio
    async def test_idle_clips_are_generated(self) -> None:
        """Idle clips should be pre-generated during initialization."""
        engine = self._create_mock_engine()
        controller = IdleController(engine=engine, num_clips=3)
        await controller.initialize()

        assert controller.has_clips
        engine.generate_idle_clips.assert_called_once()

    @pytest.mark.asyncio
    async def test_continuous_frame_output(self) -> None:
        """Idle controller must never return None when clips are loaded."""
        engine = self._create_mock_engine()
        controller = IdleController(engine=engine, num_clips=3)
        await controller.initialize()

        controller.start_idle()

        # Request 500 frames (well beyond single clip length)
        none_count = 0
        for _ in range(500):
            frame = controller.get_next_frame()
            if frame is None:
                none_count += 1

        assert none_count == 0, f"Got {none_count} None frames out of 500"

    @pytest.mark.asyncio
    async def test_no_identical_consecutive_frames(self) -> None:
        """Consecutive frames should not be pixel-identical (would look frozen)."""
        engine = self._create_mock_engine()
        controller = IdleController(engine=engine, num_clips=3)
        await controller.initialize()

        controller.start_idle()

        prev_frame = None
        identical_count = 0
        total_checked = 0

        for _ in range(200):
            frame = controller.get_next_frame()
            if frame is not None and prev_frame is not None:
                total_checked += 1
                if np.array_equal(frame.data, prev_frame.data):
                    identical_count += 1
            prev_frame = frame

        # Allow up to 5% identical frames (clip boundaries)
        max_allowed = int(total_checked * 0.05)
        assert identical_count <= max_allowed, (
            f"{identical_count}/{total_checked} identical consecutive frames "
            f"(max allowed: {max_allowed})"
        )

    @pytest.mark.asyncio
    async def test_crossfade_transition(self) -> None:
        """Speaking-to-idle transition should produce cross-faded frames."""
        engine = self._create_mock_engine()
        controller = IdleController(
            engine=engine, num_clips=3, crossfade_frames=4
        )
        await controller.initialize()

        # Simulate transition from speaking (use 0 to maximize contrast with random idle clips)
        last_speaking_frame = np.zeros((512, 512, 3), dtype=np.uint8)
        controller.start_idle(last_speaking_frame=last_speaking_frame)

        # First frames should be blended (not identical to speaking or idle)
        transition_frames = []
        for _ in range(4):
            frame = controller.get_next_frame()
            if frame is not None:
                transition_frames.append(frame.data)

        assert len(transition_frames) == 4
        # The last transition frame (highest alpha) should differ most from speaking frame
        # At least one frame must not be identical to the all-black speaking frame
        any_different = any(
            not np.array_equal(tf, last_speaking_frame) for tf in transition_frames
        )
        assert any_different, "All crossfade frames are identical to the speaking frame"

    @pytest.mark.asyncio
    async def test_stop_idle_returns_frame(self) -> None:
        """Stopping idle should return the current frame for transition reference."""
        engine = self._create_mock_engine()
        controller = IdleController(engine=engine, num_clips=3)
        await controller.initialize()

        controller.start_idle()
        controller.get_next_frame()  # Advance by one frame

        result = controller.stop_idle()
        assert result is not None
        assert not controller.is_idle

    @pytest.mark.asyncio
    async def test_clip_looping(self) -> None:
        """Clips should loop continuously without interruption."""
        engine = self._create_mock_engine()
        # Small clips for easy testing
        engine.generate_idle_clips = AsyncMock(
            return_value=_make_idle_clips(2, 10)
        )
        controller = IdleController(
            engine=engine, num_clips=2, crossfade_frames=0
        )
        await controller.initialize()

        controller.start_idle()

        # Request more frames than all clips combined
        frames_received = 0
        for _ in range(100):
            frame = controller.get_next_frame()
            if frame is not None:
                frames_received += 1

        assert frames_received == 100

    @pytest.mark.asyncio
    async def test_five_minute_idle(self) -> None:
        """
        Simulate 5 minutes of idle at 25 FPS.
        All frames should be non-None (no freezing).
        """
        engine = self._create_mock_engine()
        controller = IdleController(engine=engine, num_clips=5, crossfade_frames=0)
        await controller.initialize()

        controller.start_idle()

        total_frames = 25 * 300  # 5 minutes at 25 FPS = 7500 frames
        none_count = 0

        for _ in range(total_frames):
            frame = controller.get_next_frame()
            if frame is None:
                none_count += 1

        assert none_count == 0, (
            f"Avatar froze {none_count} times during 5-minute idle test "
            f"({none_count}/{total_frames} frames)"
        )
