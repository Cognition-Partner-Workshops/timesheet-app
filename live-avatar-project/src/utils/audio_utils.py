"""
Audio utility functions for chunking, resampling, and format conversion.
"""

import logging
from typing import Optional

import numpy as np
import numpy.typing as npt

logger = logging.getLogger(__name__)


def resample_audio(
    audio: npt.NDArray[np.float32],
    source_rate: int,
    target_rate: int,
) -> npt.NDArray[np.float32]:
    """
    Resample audio from source_rate to target_rate using linear interpolation.

    For production use with critical quality, consider using librosa.resample
    or scipy.signal.resample. This implementation is fast and sufficient for
    real-time streaming where latency matters more than perfect quality.

    Args:
        audio: Input audio samples as float32 [-1.0, 1.0].
        source_rate: Source sample rate in Hz.
        target_rate: Target sample rate in Hz.

    Returns:
        Resampled audio as float32 array.
    """
    if source_rate == target_rate:
        return audio

    duration = len(audio) / source_rate
    target_length = int(duration * target_rate)

    if target_length == 0:
        return np.zeros(0, dtype=np.float32)

    indices = np.linspace(0, len(audio) - 1, target_length)
    resampled = np.interp(indices, np.arange(len(audio)), audio)
    return resampled.astype(np.float32)


def pcm16_to_float32(pcm_data: bytes) -> npt.NDArray[np.float32]:
    """
    Convert 16-bit PCM bytes to float32 array in [-1.0, 1.0] range.

    Args:
        pcm_data: Raw 16-bit signed little-endian PCM bytes.

    Returns:
        Float32 numpy array normalized to [-1.0, 1.0].
    """
    samples = np.frombuffer(pcm_data, dtype=np.int16)
    return samples.astype(np.float32) / 32768.0


def float32_to_pcm16(audio: npt.NDArray[np.float32]) -> bytes:
    """
    Convert float32 audio array to 16-bit PCM bytes.

    Args:
        audio: Float32 audio samples in [-1.0, 1.0] range.

    Returns:
        Raw 16-bit signed little-endian PCM bytes.
    """
    clipped = np.clip(audio, -1.0, 1.0)
    pcm = (clipped * 32767).astype(np.int16)
    return pcm.tobytes()


def create_silent_chunk(
    duration_sec: float,
    sample_rate: int = 16000,
) -> npt.NDArray[np.float32]:
    """
    Create a silent audio chunk of the specified duration.

    Args:
        duration_sec: Duration in seconds.
        sample_rate: Sample rate in Hz.

    Returns:
        Zero-valued float32 array.
    """
    num_samples = int(duration_sec * sample_rate)
    return np.zeros(num_samples, dtype=np.float32)


def chunk_audio(
    audio: npt.NDArray[np.float32],
    chunk_size: int,
    overlap: int = 0,
) -> list[npt.NDArray[np.float32]]:
    """
    Split audio into fixed-size chunks with optional overlap.

    Args:
        audio: Input audio samples.
        chunk_size: Number of samples per chunk.
        overlap: Number of overlapping samples between consecutive chunks.

    Returns:
        List of audio chunks. The last chunk is zero-padded if needed.
    """
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be in [0, chunk_size)")

    chunks: list[npt.NDArray[np.float32]] = []
    step = chunk_size - overlap
    total_samples = len(audio)

    for start in range(0, total_samples, step):
        end = start + chunk_size
        if end <= total_samples:
            chunks.append(audio[start:end])
        else:
            # Zero-pad the last chunk
            padded = np.zeros(chunk_size, dtype=np.float32)
            remaining = total_samples - start
            padded[:remaining] = audio[start:]
            chunks.append(padded)
            break

    return chunks


def compute_rms(audio: npt.NDArray[np.float32]) -> float:
    """Compute the root mean square energy of an audio signal."""
    if len(audio) == 0:
        return 0.0
    return float(np.sqrt(np.mean(audio ** 2)))


def detect_language_from_audio(audio: npt.NDArray[np.float32]) -> Optional[str]:
    """
    Placeholder for audio-based language detection.

    In production, this would use Whisper's language detection or a
    dedicated language ID model. Returns None (auto-detect) by default.
    The actual language detection happens in the STT pipeline.
    """
    return None


class AudioAccumulator:
    """
    Accumulates audio samples and yields fixed-size chunks.

    Useful for converting variable-size WebRTC audio frames into
    fixed-size chunks expected by the avatar engine.
    """

    def __init__(self, chunk_size: int, sample_rate: int = 16000) -> None:
        self._chunk_size = chunk_size
        self._sample_rate = sample_rate
        self._buffer = np.zeros(0, dtype=np.float32)

    @property
    def chunk_size(self) -> int:
        return self._chunk_size

    @property
    def buffered_samples(self) -> int:
        return len(self._buffer)

    @property
    def buffered_duration_sec(self) -> float:
        return len(self._buffer) / self._sample_rate

    def add_samples(
        self, samples: npt.NDArray[np.float32]
    ) -> list[npt.NDArray[np.float32]]:
        """
        Add samples to the buffer and return any complete chunks.

        Args:
            samples: New audio samples to add.

        Returns:
            List of complete chunks (may be empty if not enough data yet).
        """
        self._buffer = np.concatenate([self._buffer, samples])

        chunks: list[npt.NDArray[np.float32]] = []
        while len(self._buffer) >= self._chunk_size:
            chunks.append(self._buffer[: self._chunk_size])
            self._buffer = self._buffer[self._chunk_size :]

        return chunks

    def flush(self) -> Optional[npt.NDArray[np.float32]]:
        """
        Return any remaining samples as a zero-padded chunk, then reset.

        Returns:
            A zero-padded chunk if there are remaining samples, else None.
        """
        if len(self._buffer) == 0:
            return None

        padded = np.zeros(self._chunk_size, dtype=np.float32)
        padded[: len(self._buffer)] = self._buffer
        self._buffer = np.zeros(0, dtype=np.float32)
        return padded

    def reset(self) -> None:
        """Clear the buffer."""
        self._buffer = np.zeros(0, dtype=np.float32)
