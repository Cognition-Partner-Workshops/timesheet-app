"""
Abstract base class for avatar engines.

Defines the interface that all avatar engine implementations must follow.
Supports MuseTalk, LiveAvatar, LivePortrait, and other engines.
"""

import abc
import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import numpy.typing as npt

logger = logging.getLogger(__name__)


@dataclass
class AvatarConfig:
    """Configuration for an avatar engine."""
    reference_image_path: str = "assets/avatar_reference.png"
    output_width: int = 512
    output_height: int = 512
    target_fps: int = 25
    use_fp16: bool = True
    use_torch_compile: bool = True
    device: str = "cuda"


@dataclass
class AudioChunk:
    """A chunk of audio data to be processed by the avatar engine."""
    data: npt.NDArray[np.float32]
    sample_rate: int = 16000
    is_silent: bool = False
    timestamp: float = 0.0


@dataclass
class VideoFrame:
    """A single video frame produced by the avatar engine."""
    data: npt.NDArray[np.uint8]  # H x W x 3 (RGB)
    width: int = 512
    height: int = 512
    timestamp: float = 0.0
    frame_index: int = 0


@dataclass
class EngineStats:
    """Runtime statistics for the avatar engine."""
    fps: float = 0.0
    frame_generation_ms: float = 0.0
    vram_usage_mb: float = 0.0
    total_frames_generated: int = 0
    dropped_frames: int = 0
    extra: dict[str, float] = field(default_factory=dict)


class BaseAvatarEngine(abc.ABC):
    """
    Abstract base class for avatar rendering engines.

    Subclasses must implement:
        - initialize(): Load models and prepare the engine
        - generate_frame(): Generate a single video frame from audio
        - generate_idle_clips(): Pre-generate idle motion clips
        - cleanup(): Release GPU resources
    """

    def __init__(self, config: AvatarConfig) -> None:
        self.config = config
        self._initialized = False
        self._stats = EngineStats()

    @property
    def is_initialized(self) -> bool:
        return self._initialized

    @property
    def stats(self) -> EngineStats:
        return self._stats

    @abc.abstractmethod
    async def initialize(self) -> None:
        """
        Initialize the engine: load models, preprocess reference image.

        Must be called before generate_frame() or generate_idle_clips().
        Should set self._initialized = True on success.
        """

    @abc.abstractmethod
    async def generate_frame(self, audio_chunk: AudioChunk) -> Optional[VideoFrame]:
        """
        Generate a single video frame driven by the given audio chunk.

        Args:
            audio_chunk: Audio data to drive lip-sync. If audio_chunk.is_silent,
                        the engine should produce subtle idle motion.

        Returns:
            A VideoFrame with the rendered avatar, or None if the frame
            was dropped due to performance constraints.
        """

    @abc.abstractmethod
    async def generate_idle_clips(
        self, num_clips: int = 5, clip_duration_sec: float = 8.0
    ) -> list[list[VideoFrame]]:
        """
        Pre-generate a library of idle motion clips.

        Each clip is a list of VideoFrames showing natural idle motion
        (breathing, blinking, subtle head movement) driven by silent audio.

        Args:
            num_clips: Number of distinct idle clips to generate.
            clip_duration_sec: Duration of each clip in seconds.

        Returns:
            A list of clips, each clip being a list of VideoFrames.
        """

    @abc.abstractmethod
    async def cleanup(self) -> None:
        """
        Release all GPU resources and clean up.

        Must be safe to call multiple times.
        """

    async def warmup(self) -> None:
        """
        Run a warmup pass to JIT-compile and cache pipelines.

        Default implementation generates one frame from silent audio.
        Override for engine-specific warmup.
        """
        if not self._initialized:
            raise RuntimeError("Engine must be initialized before warmup")

        logger.info("Running warmup pass...")
        silent_chunk = AudioChunk(
            data=np.zeros(int(0.5 * 16000), dtype=np.float32),
            sample_rate=16000,
            is_silent=True,
        )
        await self.generate_frame(silent_chunk)
        logger.info("Warmup complete")

    def get_frame_duration_ms(self) -> float:
        """Duration of a single frame in milliseconds."""
        return 1000.0 / self.config.target_fps
