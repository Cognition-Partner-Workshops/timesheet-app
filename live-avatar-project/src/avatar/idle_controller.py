"""
Idle Motion Controller - Ensures the avatar never appears frozen.

Manages pre-generated idle clips, cross-fade transitions, and
randomized playback to create natural-looking idle behavior.

The avatar must NEVER look like a static photo when not speaking.
"""

import asyncio
import logging
import random
import time
from typing import Optional

import cv2
import numpy as np
import numpy.typing as npt

from src.avatar.base import BaseAvatarEngine, VideoFrame

logger = logging.getLogger(__name__)


class IdleController:
    """
    Controls idle motion playback for the avatar.

    Features:
        - Pre-generates idle clips from the avatar engine
        - Cross-fades between speaking and idle states
        - Randomized clip ordering to avoid repetition
        - Continuous frame output — never returns None
    """

    def __init__(
        self,
        engine: BaseAvatarEngine,
        num_clips: int = 5,
        clip_duration_sec: float = 8.0,
        crossfade_frames: int = 4,
        target_fps: int = 25,
        randomize_order: bool = True,
    ) -> None:
        self._engine = engine
        self._num_clips = num_clips
        self._clip_duration_sec = clip_duration_sec
        self._crossfade_frames = crossfade_frames
        self._target_fps = target_fps
        self._randomize_order = randomize_order

        # Idle clip storage
        self._idle_clips: list[list[VideoFrame]] = []
        self._clip_order: list[int] = []
        self._current_clip_idx = 0
        self._current_frame_idx = 0

        # Transition state
        self._is_transitioning = False
        self._transition_frames_remaining = 0
        self._transition_from_frame: Optional[npt.NDArray[np.uint8]] = None
        self._last_speaking_frame: Optional[npt.NDArray[np.uint8]] = None

        # Playback state
        self._is_idle = False
        self._idle_start_time: Optional[float] = None
        self._total_idle_frames = 0

    @property
    def is_idle(self) -> bool:
        return self._is_idle

    @property
    def has_clips(self) -> bool:
        return len(self._idle_clips) > 0

    async def initialize(self) -> None:
        """Pre-generate idle motion clips from the avatar engine."""
        logger.info(
            "Generating %d idle clips (%.1fs each)...",
            self._num_clips,
            self._clip_duration_sec,
        )
        self._idle_clips = await self._engine.generate_idle_clips(
            num_clips=self._num_clips,
            clip_duration_sec=self._clip_duration_sec,
        )

        if not self._idle_clips:
            logger.warning("No idle clips were generated")
            return

        # Initialize playback order
        self._shuffle_clip_order()
        logger.info(
            "Idle controller ready: %d clips, %d total frames",
            len(self._idle_clips),
            sum(len(clip) for clip in self._idle_clips),
        )

    def _shuffle_clip_order(self) -> None:
        """Randomize the order in which idle clips are played."""
        self._clip_order = list(range(len(self._idle_clips)))
        if self._randomize_order:
            random.shuffle(self._clip_order)
        self._current_clip_idx = 0
        self._current_frame_idx = 0

    def start_idle(self, last_speaking_frame: Optional[npt.NDArray[np.uint8]] = None) -> None:
        """
        Begin idle motion playback.

        Args:
            last_speaking_frame: The last frame from the speaking state,
                used as the starting point for cross-fade transition.
        """
        self._is_idle = True
        self._idle_start_time = time.monotonic()
        self._last_speaking_frame = last_speaking_frame

        # Start cross-fade transition if we have a speaking frame
        if last_speaking_frame is not None and self._crossfade_frames > 0:
            self._is_transitioning = True
            self._transition_frames_remaining = self._crossfade_frames
            self._transition_from_frame = last_speaking_frame.copy()
        else:
            self._is_transitioning = False

        logger.debug("Idle motion started (with_crossfade=%s)", self._is_transitioning)

    def stop_idle(self) -> Optional[npt.NDArray[np.uint8]]:
        """
        Stop idle motion and return the current idle frame.

        Returns the last idle frame for potential transition to speaking state.
        Speaking starts immediately (no cross-fade needed, matches natural behavior).
        """
        self._is_idle = False
        idle_duration = (
            time.monotonic() - self._idle_start_time
            if self._idle_start_time
            else 0.0
        )
        logger.debug(
            "Idle motion stopped after %.2fs (%d frames)",
            idle_duration,
            self._total_idle_frames,
        )
        self._total_idle_frames = 0

        # Return current frame for transition reference
        return self._get_current_clip_frame_data()

    def get_next_frame(self) -> Optional[VideoFrame]:
        """
        Get the next idle motion frame.

        Handles cross-fade transitions and continuous clip looping.

        Returns:
            The next VideoFrame, or None if no idle clips are available.
        """
        if not self._idle_clips:
            return None

        if self._is_transitioning:
            frame = self._get_crossfade_frame()
        else:
            frame = self._get_next_clip_frame()

        if frame is not None:
            self._total_idle_frames += 1

        return frame

    def _get_crossfade_frame(self) -> Optional[VideoFrame]:
        """Generate a cross-fade frame between speaking and idle."""
        if self._transition_frames_remaining <= 0:
            self._is_transitioning = False
            return self._get_next_clip_frame()

        idle_frame = self._get_next_clip_frame()
        if idle_frame is None:
            self._is_transitioning = False
            return None

        if self._transition_from_frame is None:
            self._is_transitioning = False
            return idle_frame

        # Compute cross-fade alpha
        progress = 1.0 - (
            self._transition_frames_remaining / self._crossfade_frames
        )
        alpha = self._ease_in_out(progress)

        # Blend frames
        from_frame = self._transition_from_frame
        to_frame = idle_frame.data

        # Ensure same dimensions
        if from_frame.shape != to_frame.shape:
            from_frame = cv2.resize(
                from_frame, (to_frame.shape[1], to_frame.shape[0])
            )

        blended = (
            from_frame.astype(np.float32) * (1.0 - alpha)
            + to_frame.astype(np.float32) * alpha
        ).astype(np.uint8)

        self._transition_frames_remaining -= 1

        return VideoFrame(
            data=blended,
            width=idle_frame.width,
            height=idle_frame.height,
            timestamp=idle_frame.timestamp,
            frame_index=idle_frame.frame_index,
        )

    def _get_next_clip_frame(self) -> Optional[VideoFrame]:
        """Get the next frame from the current idle clip, looping as needed."""
        if not self._idle_clips or not self._clip_order:
            return None

        clip_index = self._clip_order[self._current_clip_idx]
        clip = self._idle_clips[clip_index]

        if not clip:
            return None

        # Get frame from current position
        frame = clip[self._current_frame_idx]
        self._current_frame_idx += 1

        # Check if clip is finished
        if self._current_frame_idx >= len(clip):
            self._current_frame_idx = 0
            self._current_clip_idx += 1

            # Loop back to start of clip order
            if self._current_clip_idx >= len(self._clip_order):
                self._shuffle_clip_order()

        return frame

    def _get_current_clip_frame_data(self) -> Optional[npt.NDArray[np.uint8]]:
        """Get the raw frame data from the current clip position."""
        if not self._idle_clips or not self._clip_order:
            return None

        clip_index = self._clip_order[self._current_clip_idx]
        clip = self._idle_clips[clip_index]

        if not clip:
            return None

        frame_idx = min(self._current_frame_idx, len(clip) - 1)
        return clip[frame_idx].data

    @staticmethod
    def _ease_in_out(t: float) -> float:
        """Smooth ease-in-out curve for cross-fade."""
        return t * t * (3.0 - 2.0 * t)
