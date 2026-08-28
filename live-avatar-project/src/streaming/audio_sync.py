"""
Audio-Video Synchronization Module.

Ensures tight synchronization between avatar video frames and TTS audio,
targeting < 100ms drift. Manages audio track publishing and timing alignment.
"""

import asyncio
import logging
import time
from collections import deque
from typing import Optional

import numpy as np
import numpy.typing as npt

from src.utils.audio_utils import float32_to_pcm16, resample_audio

logger = logging.getLogger(__name__)


class SyncedAudioFrame:
    """An audio frame with timing metadata for synchronization."""

    def __init__(
        self,
        data: npt.NDArray[np.float32],
        sample_rate: int,
        timestamp: float,
        duration_sec: float,
    ) -> None:
        self.data = data
        self.sample_rate = sample_rate
        self.timestamp = timestamp
        self.duration_sec = duration_sec


class AudioVideoSync:
    """
    Manages audio-video synchronization for the avatar streaming pipeline.

    Approach:
        - Maintains a shared timeline between audio and video
        - Audio frames are timestamped when received from TTS
        - Video frames are generated with matching timestamps
        - Drift is monitored and compensated by adjusting frame timing

    Target: < 100ms audio-video drift at all times.
    """

    def __init__(
        self,
        audio_sample_rate: int = 48000,
        video_fps: int = 25,
        max_drift_ms: float = 100.0,
        audio_buffer_size: int = 20,
    ) -> None:
        self._audio_sample_rate = audio_sample_rate
        self._video_fps = video_fps
        self._max_drift_ms = max_drift_ms
        self._frame_duration = 1.0 / video_fps

        # Audio track (LiveKit)
        self._audio_source = None
        self._audio_track = None

        # Sync timeline
        self._timeline_start: Optional[float] = None
        self._audio_position = 0.0  # Current audio playback position (seconds)
        self._video_position = 0.0  # Current video frame position (seconds)

        # Audio buffer for publishing
        self._audio_buffer: deque[SyncedAudioFrame] = deque(
            maxlen=audio_buffer_size
        )
        self._running = False
        self._audio_task: Optional[asyncio.Task[None]] = None

        # Drift tracking
        self._drift_samples: list[float] = []
        self._max_recorded_drift_ms = 0.0

    @property
    def current_drift_ms(self) -> float:
        """Current audio-video drift in milliseconds."""
        return (self._audio_position - self._video_position) * 1000.0

    @property
    def max_recorded_drift_ms(self) -> float:
        return self._max_recorded_drift_ms

    @property
    def avg_drift_ms(self) -> float:
        if not self._drift_samples:
            return 0.0
        return float(np.mean(self._drift_samples[-100:]))

    async def initialize(self, room: "livekit.Room") -> None:
        """
        Create and publish an audio track to the LiveKit room.

        The audio track is synchronized with the video track from VideoPublisher.
        """
        try:
            from livekit import rtc

            # Create audio source (48kHz mono for WebRTC)
            self._audio_source = rtc.AudioSource(
                self._audio_sample_rate, 1  # mono
            )

            # Create local audio track
            self._audio_track = rtc.LocalAudioTrack.create_audio_track(
                "avatar-audio", self._audio_source
            )

            # Publish the track
            options = rtc.TrackPublishOptions()
            options.source = rtc.TrackSource.SOURCE_MICROPHONE

            publication = await room.local_participant.publish_track(
                self._audio_track, options
            )

            logger.info(
                "Audio track published: %s (sid=%s, %dHz mono)",
                publication.track.name if publication.track else "unknown",
                publication.sid,
                self._audio_sample_rate,
            )

        except ImportError:
            logger.error("livekit package not available")
            raise

    async def start(self) -> None:
        """Start the audio publishing loop."""
        if self._running:
            return

        self._running = True
        self._timeline_start = time.monotonic()
        self._audio_task = asyncio.create_task(self._audio_publish_loop())
        logger.info("Audio sync started")

    async def stop(self) -> None:
        """Stop the audio publishing loop."""
        self._running = False
        if self._audio_task:
            self._audio_task.cancel()
            try:
                await self._audio_task
            except asyncio.CancelledError:
                pass
            self._audio_task = None
        logger.info(
            "Audio sync stopped. Avg drift: %.1fms, Max drift: %.1fms",
            self.avg_drift_ms,
            self._max_recorded_drift_ms,
        )

    async def push_audio(
        self,
        audio_data: npt.NDArray[np.float32],
        source_sample_rate: int = 16000,
    ) -> None:
        """
        Push TTS audio data for synchronized publishing.

        Audio is resampled to the output sample rate if needed,
        then queued for time-aligned publishing.

        Args:
            audio_data: Float32 audio samples from TTS.
            source_sample_rate: Sample rate of the input audio.
        """
        # Resample to output rate if needed
        if source_sample_rate != self._audio_sample_rate:
            audio_data = resample_audio(
                audio_data, source_sample_rate, self._audio_sample_rate
            )

        duration = len(audio_data) / self._audio_sample_rate
        timestamp = self._audio_position

        frame = SyncedAudioFrame(
            data=audio_data,
            sample_rate=self._audio_sample_rate,
            timestamp=timestamp,
            duration_sec=duration,
        )

        self._audio_buffer.append(frame)
        self._audio_position += duration

    def update_video_position(self, frame_timestamp: float) -> None:
        """
        Update the video position for drift calculation.

        Called by the video publisher after each frame is rendered.
        """
        self._video_position = frame_timestamp

        # Record drift
        drift = abs(self.current_drift_ms)
        self._drift_samples.append(drift)
        if len(self._drift_samples) > 500:
            self._drift_samples = self._drift_samples[-500:]

        self._max_recorded_drift_ms = max(self._max_recorded_drift_ms, drift)

        if drift > self._max_drift_ms:
            logger.warning(
                "A/V drift exceeded threshold: %.1fms (max: %.1fms)",
                drift,
                self._max_drift_ms,
            )

    async def _audio_publish_loop(self) -> None:
        """Continuously publish audio frames from the buffer."""
        # Size of audio frames to publish at a time (match video frame rate)
        samples_per_frame = int(self._audio_sample_rate / self._video_fps)

        while self._running:
            try:
                if self._audio_buffer and self._audio_source is not None:
                    frame = self._audio_buffer.popleft()
                    await self._publish_audio_frame(frame)
                else:
                    # Publish silence to keep the audio track alive
                    silence = np.zeros(samples_per_frame, dtype=np.float32)
                    silent_frame = SyncedAudioFrame(
                        data=silence,
                        sample_rate=self._audio_sample_rate,
                        timestamp=self._audio_position,
                        duration_sec=self._frame_duration,
                    )
                    await self._publish_audio_frame(silent_frame)

                await asyncio.sleep(self._frame_duration)

            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("Error in audio publish loop")
                await asyncio.sleep(self._frame_duration)

    async def _publish_audio_frame(self, frame: SyncedAudioFrame) -> None:
        """Publish a single audio frame to the LiveKit audio source."""
        if self._audio_source is None:
            return

        try:
            from livekit import rtc

            # Convert float32 to int16 PCM for LiveKit
            pcm_data = float32_to_pcm16(frame.data)
            samples = np.frombuffer(pcm_data, dtype=np.int16)

            # Create LiveKit AudioFrame
            audio_frame = rtc.AudioFrame(
                data=samples.tobytes(),
                sample_rate=frame.sample_rate,
                num_channels=1,
                samples_per_channel=len(samples),
            )

            await self._audio_source.capture_frame(audio_frame)

        except Exception:
            logger.exception("Failed to publish audio frame")

    def reset_timeline(self) -> None:
        """Reset the sync timeline for a new conversation turn."""
        self._timeline_start = time.monotonic()
        self._audio_position = 0.0
        self._video_position = 0.0
        self._audio_buffer.clear()
        self._drift_samples.clear()
        logger.debug("Sync timeline reset")
