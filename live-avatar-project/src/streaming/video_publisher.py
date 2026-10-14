"""
LiveKit Video Track Publisher.

Publishes avatar video frames as a LiveKit video track via WebRTC.
Handles frame rate control, format conversion, and track lifecycle.
"""

import asyncio
import logging
import time
from typing import Optional

import numpy as np
import numpy.typing as npt

from src.avatar.base import VideoFrame

logger = logging.getLogger(__name__)

# Frame format conversion constants
ARGB_CHANNELS = 4


class VideoPublisher:
    """
    Publishes video frames to a LiveKit room as a video track.

    Features:
        - Constant frame-rate output (drops/duplicates frames as needed)
        - RGB to I420/ARGB conversion for WebRTC
        - Frame queue with backpressure handling
        - Statistics tracking (FPS, dropped frames, latency)
    """

    def __init__(
        self,
        width: int = 512,
        height: int = 512,
        fps: int = 25,
        queue_size: int = 5,
    ) -> None:
        self._width = width
        self._height = height
        self._fps = fps
        self._frame_interval = 1.0 / fps
        self._queue: asyncio.Queue[VideoFrame] = asyncio.Queue(maxsize=queue_size)
        self._running = False
        self._publish_task: Optional[asyncio.Task[None]] = None

        # LiveKit track reference
        self._video_source = None
        self._video_track = None

        # Stats
        self._frames_published = 0
        self._frames_dropped = 0
        self._last_frame_time = 0.0
        self._publish_latencies: list[float] = []

    @property
    def fps(self) -> int:
        return self._fps

    @property
    def frames_published(self) -> int:
        return self._frames_published

    @property
    def frames_dropped(self) -> int:
        return self._frames_dropped

    @property
    def avg_publish_latency_ms(self) -> float:
        if not self._publish_latencies:
            return 0.0
        return float(np.mean(self._publish_latencies[-100:]))

    async def initialize(self, room: "livekit.Room") -> None:
        """
        Create and publish a video track to the LiveKit room.

        Args:
            room: The LiveKit room to publish the video track to.
        """
        try:
            from livekit import rtc

            # Create a video source with the target resolution and FPS
            self._video_source = rtc.VideoSource(self._width, self._height)

            # Create a local video track from the source
            self._video_track = rtc.LocalVideoTrack.create_video_track(
                "avatar-video", self._video_source
            )

            # Publish the track to the room
            options = rtc.TrackPublishOptions()
            options.source = rtc.TrackSource.SOURCE_CAMERA

            publication = await room.local_participant.publish_track(
                self._video_track, options
            )

            logger.info(
                "Video track published: %s (sid=%s, %dx%d @ %dfps)",
                publication.track.name if publication.track else "unknown",
                publication.sid,
                self._width,
                self._height,
                self._fps,
            )

        except ImportError:
            logger.error(
                "livekit package not available. "
                "Install with: pip install livekit"
            )
            raise
        except Exception:
            logger.exception("Failed to initialize video publisher")
            raise

    async def start(self) -> None:
        """Start the frame publishing loop."""
        if self._running:
            return

        self._running = True
        self._publish_task = asyncio.create_task(self._publish_loop())
        logger.info("Video publisher started at %d FPS", self._fps)

    async def stop(self) -> None:
        """Stop the frame publishing loop."""
        self._running = False
        if self._publish_task:
            self._publish_task.cancel()
            try:
                await self._publish_task
            except asyncio.CancelledError:
                pass
            self._publish_task = None

        logger.info(
            "Video publisher stopped. Published: %d, Dropped: %d",
            self._frames_published,
            self._frames_dropped,
        )

    async def push_frame(self, frame: VideoFrame) -> bool:
        """
        Push a frame to the publish queue.

        Returns True if the frame was queued, False if dropped due to backpressure.
        """
        try:
            self._queue.put_nowait(frame)
            return True
        except asyncio.QueueFull:
            # Drop oldest frame and add new one (prefer recent frames)
            try:
                self._queue.get_nowait()
                self._frames_dropped += 1
            except asyncio.QueueEmpty:
                pass
            try:
                self._queue.put_nowait(frame)
                return True
            except asyncio.QueueFull:
                self._frames_dropped += 1
                return False

    async def _publish_loop(self) -> None:
        """Main loop that publishes frames at the target FPS."""
        last_frame: Optional[VideoFrame] = None

        while self._running:
            loop_start = time.monotonic()

            try:
                # Try to get a new frame (with short timeout)
                try:
                    frame = self._queue.get_nowait()
                    last_frame = frame
                except asyncio.QueueEmpty:
                    frame = last_frame  # Repeat last frame if queue is empty

                if frame is not None:
                    await self._publish_frame(frame)

                # Sleep to maintain target FPS
                elapsed = time.monotonic() - loop_start
                sleep_time = self._frame_interval - elapsed
                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)
                else:
                    # We're behind schedule — don't sleep, catch up
                    await asyncio.sleep(0)  # Yield to event loop

            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("Error in publish loop")
                await asyncio.sleep(self._frame_interval)

    async def _publish_frame(self, frame: VideoFrame) -> None:
        """Convert and publish a single frame to the LiveKit video source."""
        publish_start = time.monotonic()

        try:
            if self._video_source is None:
                return

            from livekit import rtc

            # Convert RGB numpy array to ARGB format for LiveKit
            argb_frame = self._rgb_to_argb(frame.data)

            # Create a LiveKit VideoFrame
            lk_frame = rtc.VideoFrame(
                width=frame.width,
                height=frame.height,
                type=rtc.VideoBufferType.ARGB,
                data=argb_frame.tobytes(),
            )

            # Capture the frame into the video source
            self._video_source.capture_frame(lk_frame)
            self._frames_published += 1

            # Track latency
            latency_ms = (time.monotonic() - publish_start) * 1000
            self._publish_latencies.append(latency_ms)
            if len(self._publish_latencies) > 200:
                self._publish_latencies = self._publish_latencies[-200:]

        except Exception:
            self._frames_dropped += 1
            logger.exception("Failed to publish frame %d", frame.frame_index)

    @staticmethod
    def _rgb_to_argb(rgb_frame: npt.NDArray[np.uint8]) -> npt.NDArray[np.uint8]:
        """
        Convert RGB frame to ARGB format for LiveKit.

        Args:
            rgb_frame: H x W x 3 uint8 array (RGB).

        Returns:
            H x W x 4 uint8 array (ARGB).
        """
        h, w = rgb_frame.shape[:2]
        argb = np.zeros((h, w, ARGB_CHANNELS), dtype=np.uint8)
        argb[:, :, 0] = 255  # Alpha channel (fully opaque)
        argb[:, :, 1:] = rgb_frame  # RGB channels
        return argb
