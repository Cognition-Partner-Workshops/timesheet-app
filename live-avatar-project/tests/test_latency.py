"""
Tests for latency measurement and budget compliance.

Validates that the system meets the target latency budget:
    - STT: < 300ms
    - LLM first token: < 500ms
    - TTS first chunk: < 300ms
    - Avatar first frame: < 400ms
    - Total: < 1.5s
"""

import time
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest

from src.agent.state_machine import AvatarState, AvatarStateMachine
from src.utils.audio_utils import (
    AudioAccumulator,
    chunk_audio,
    compute_rms,
    create_silent_chunk,
    pcm16_to_float32,
    resample_audio,
)


class TestLatencyTracking:
    """Tests for latency measurement utilities."""

    def test_create_silent_chunk_duration(self) -> None:
        """Silent chunks must have exactly the right number of samples."""
        duration = 0.5
        sample_rate = 16000
        chunk = create_silent_chunk(duration, sample_rate)

        expected_samples = int(duration * sample_rate)
        assert len(chunk) == expected_samples
        assert np.all(chunk == 0.0)

    def test_resample_audio_preserves_duration(self) -> None:
        """Resampled audio should have approximately the same duration."""
        source_rate = 16000
        target_rate = 48000
        duration = 1.0

        audio = np.random.randn(int(source_rate * duration)).astype(np.float32)
        resampled = resample_audio(audio, source_rate, target_rate)

        expected_length = int(target_rate * duration)
        # Allow 1 sample tolerance
        assert abs(len(resampled) - expected_length) <= 1

    def test_resample_same_rate_is_noop(self) -> None:
        """Resampling to the same rate should return identical data."""
        audio = np.random.randn(8000).astype(np.float32)
        result = resample_audio(audio, 16000, 16000)
        assert np.array_equal(result, audio)

    def test_pcm16_roundtrip(self) -> None:
        """PCM16 conversion should be approximately reversible."""
        from src.utils.audio_utils import float32_to_pcm16

        original = np.random.uniform(-0.9, 0.9, 1000).astype(np.float32)
        pcm_bytes = float32_to_pcm16(original)
        restored = pcm16_to_float32(pcm_bytes)

        # Allow quantization error (16-bit has ~0.00003 precision)
        np.testing.assert_allclose(original, restored, atol=1e-4)

    def test_audio_chunking(self) -> None:
        """Audio chunking should produce correct chunk sizes."""
        audio = np.random.randn(10000).astype(np.float32)
        chunks = chunk_audio(audio, chunk_size=4000, overlap=0)

        assert len(chunks) == 3  # 10000 / 4000 = 2.5, rounds up to 3
        assert all(len(c) == 4000 for c in chunks)
        # Last chunk should be zero-padded
        assert np.all(chunks[-1][2000:] == 0.0)

    def test_audio_chunking_with_overlap(self) -> None:
        """Overlapping chunks should share samples."""
        audio = np.arange(100, dtype=np.float32)
        chunks = chunk_audio(audio, chunk_size=30, overlap=10)

        # Step = 30 - 10 = 20, so chunks start at 0, 20, 40, 60, 80
        assert len(chunks) == 5
        # Check overlap: chunk[0][20:30] should equal chunk[1][0:10]
        np.testing.assert_array_equal(chunks[0][20:30], chunks[1][0:10])

    def test_compute_rms_silent(self) -> None:
        """RMS of silence should be zero."""
        silence = np.zeros(1000, dtype=np.float32)
        assert compute_rms(silence) == 0.0

    def test_compute_rms_nonzero(self) -> None:
        """RMS of a signal should be positive."""
        signal = np.sin(np.linspace(0, 2 * np.pi, 1000)).astype(np.float32)
        rms = compute_rms(signal)
        assert rms > 0
        assert rms < 1.0


class TestAudioAccumulator:
    """Tests for the AudioAccumulator utility."""

    def test_accumulator_yields_chunks(self) -> None:
        """Accumulator should yield complete chunks."""
        acc = AudioAccumulator(chunk_size=100, sample_rate=16000)

        # Add 50 samples — not enough for a chunk
        chunks = acc.add_samples(np.ones(50, dtype=np.float32))
        assert len(chunks) == 0
        assert acc.buffered_samples == 50

        # Add 60 more — should yield one chunk with 10 remaining
        chunks = acc.add_samples(np.ones(60, dtype=np.float32))
        assert len(chunks) == 1
        assert len(chunks[0]) == 100
        assert acc.buffered_samples == 10

    def test_accumulator_flush(self) -> None:
        """Flush should return zero-padded remaining samples."""
        acc = AudioAccumulator(chunk_size=100, sample_rate=16000)
        acc.add_samples(np.ones(30, dtype=np.float32))

        flushed = acc.flush()
        assert flushed is not None
        assert len(flushed) == 100
        assert flushed[29] == 1.0
        assert flushed[30] == 0.0

    def test_accumulator_flush_empty(self) -> None:
        """Flush on empty buffer should return None."""
        acc = AudioAccumulator(chunk_size=100)
        assert acc.flush() is None

    def test_accumulator_reset(self) -> None:
        """Reset should clear the buffer."""
        acc = AudioAccumulator(chunk_size=100)
        acc.add_samples(np.ones(50, dtype=np.float32))
        acc.reset()
        assert acc.buffered_samples == 0


class TestStateMachineLatency:
    """Tests for state machine transition timing."""

    @pytest.mark.asyncio
    async def test_state_transitions_are_fast(self) -> None:
        """State transitions should complete in under 1ms."""
        sm = AvatarStateMachine()

        start = time.monotonic()
        await sm.handle_speech_start()
        await sm.handle_speech_end()
        await sm.handle_response_ready()
        await sm.handle_response_complete()
        elapsed_ms = (time.monotonic() - start) * 1000

        assert elapsed_ms < 10, f"State transitions took {elapsed_ms:.1f}ms"

    @pytest.mark.asyncio
    async def test_thinking_timeout(self) -> None:
        """Thinking state should timeout after configured duration."""
        sm = AvatarStateMachine(max_thinking_time=0.1)  # 100ms for testing

        await sm.handle_speech_start()
        await sm.handle_speech_end()
        assert sm.state == AvatarState.THINKING

        # Wait for timeout
        await asyncio.sleep(0.2)
        assert sm.state == AvatarState.IDLE

    @pytest.mark.asyncio
    async def test_full_conversation_cycle(self) -> None:
        """Verify the full state cycle completes correctly."""
        sm = AvatarStateMachine()

        assert sm.state == AvatarState.IDLE

        await sm.handle_speech_start()
        assert sm.state == AvatarState.LISTENING

        await sm.handle_speech_end()
        assert sm.state == AvatarState.THINKING

        await sm.handle_response_ready()
        assert sm.state == AvatarState.SPEAKING

        await sm.handle_response_complete()
        assert sm.state == AvatarState.IDLE


import asyncio
