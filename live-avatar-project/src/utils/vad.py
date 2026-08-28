"""
Voice Activity Detection (VAD) wrapper using Silero VAD.

Provides a high-level interface for detecting speech segments in
streaming audio, used for turn-end detection in the conversation pipeline.
"""

import logging
import time
from typing import Optional

import numpy as np
import numpy.typing as npt

logger = logging.getLogger(__name__)


class SileroVADWrapper:
    """
    Wrapper around Silero VAD for streaming voice activity detection.

    Features:
        - Streaming-compatible: processes audio chunk by chunk
        - Configurable speech/silence thresholds
        - Turn-end detection with configurable silence duration
        - Speech segment timing information
    """

    def __init__(
        self,
        threshold: float = 0.5,
        min_speech_duration: float = 0.25,
        min_silence_duration: float = 0.5,
        sample_rate: int = 16000,
        window_size: int = 512,
    ) -> None:
        """
        Initialize the Silero VAD wrapper.

        Args:
            threshold: VAD probability threshold (0.0 - 1.0).
            min_speech_duration: Minimum speech duration to register (seconds).
            min_silence_duration: Silence duration for turn-end detection (seconds).
            sample_rate: Expected audio sample rate (must be 16000 for Silero).
            window_size: Number of samples per VAD window (512 for 16kHz).
        """
        self._threshold = threshold
        self._min_speech_duration = min_speech_duration
        self._min_silence_duration = min_silence_duration
        self._sample_rate = sample_rate
        self._window_size = window_size

        # State tracking
        self._is_speech = False
        self._speech_start_time: Optional[float] = None
        self._last_speech_time: Optional[float] = None
        self._model_loaded = False
        self._model = None

    async def initialize(self) -> None:
        """Load the Silero VAD model."""
        try:
            import torch
            model, _ = torch.hub.load(
                repo_or_dir="snakers4/silero-vad",
                model="silero_vad",
                force_reload=False,
                onnx=False,
            )
            self._model = model
            self._model_loaded = True
            logger.info("Silero VAD model loaded successfully")
        except Exception:
            logger.exception("Failed to load Silero VAD model")
            raise

    def process_chunk(
        self, audio_chunk: npt.NDArray[np.float32]
    ) -> dict[str, object]:
        """
        Process an audio chunk and return VAD results.

        Args:
            audio_chunk: Audio samples as float32 array.

        Returns:
            Dictionary with keys:
                - is_speech (bool): Whether speech is detected
                - probability (float): Raw VAD probability
                - speech_started (bool): True on speech onset
                - speech_ended (bool): True when silence threshold exceeded
                - speech_duration (float): Duration of current speech segment
                - silence_duration (float): Duration of current silence
        """
        if not self._model_loaded or self._model is None:
            raise RuntimeError("VAD model not initialized. Call initialize() first.")

        import torch

        current_time = time.monotonic()

        # Process in windows of the expected size
        probabilities: list[float] = []
        for i in range(0, len(audio_chunk), self._window_size):
            window = audio_chunk[i : i + self._window_size]
            if len(window) < self._window_size:
                # Pad the last window
                padded = np.zeros(self._window_size, dtype=np.float32)
                padded[: len(window)] = window
                window = padded

            tensor = torch.from_numpy(window)
            prob = self._model(tensor, self._sample_rate).item()
            probabilities.append(prob)

        avg_probability = float(np.mean(probabilities)) if probabilities else 0.0
        is_speech_now = avg_probability >= self._threshold

        # Detect transitions
        speech_started = False
        speech_ended = False

        if is_speech_now and not self._is_speech:
            # Speech onset
            self._is_speech = True
            self._speech_start_time = current_time
            self._last_speech_time = current_time
            speech_started = True
            logger.debug("Speech started (prob=%.3f)", avg_probability)

        elif is_speech_now and self._is_speech:
            # Continuing speech
            self._last_speech_time = current_time

        elif not is_speech_now and self._is_speech:
            # Potential speech end — check silence duration
            if self._last_speech_time is not None:
                silence_dur = current_time - self._last_speech_time
                if silence_dur >= self._min_silence_duration:
                    # Confirm speech end
                    speech_duration = (
                        (self._last_speech_time - self._speech_start_time)
                        if self._speech_start_time is not None
                        else 0.0
                    )
                    if speech_duration >= self._min_speech_duration:
                        speech_ended = True
                        logger.debug(
                            "Speech ended (duration=%.2fs, silence=%.2fs)",
                            speech_duration,
                            silence_dur,
                        )
                    self._is_speech = False
                    self._speech_start_time = None

        # Compute durations
        speech_duration = 0.0
        if self._is_speech and self._speech_start_time is not None:
            speech_duration = current_time - self._speech_start_time

        silence_duration = 0.0
        if not self._is_speech and self._last_speech_time is not None:
            silence_duration = current_time - self._last_speech_time

        return {
            "is_speech": is_speech_now,
            "probability": avg_probability,
            "speech_started": speech_started,
            "speech_ended": speech_ended,
            "speech_duration": speech_duration,
            "silence_duration": silence_duration,
        }

    def reset(self) -> None:
        """Reset VAD state for a new conversation turn."""
        self._is_speech = False
        self._speech_start_time = None
        self._last_speech_time = None
        if self._model is not None:
            self._model.reset_states()
        logger.debug("VAD state reset")

    @property
    def is_speech(self) -> bool:
        """Whether speech is currently being detected."""
        return self._is_speech
