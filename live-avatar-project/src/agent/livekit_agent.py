"""
LiveKit Agent - Main orchestration layer.

Connects to a LiveKit room, receives user audio via WebRTC,
processes it through the STT->LLM->TTS pipeline, generates
avatar video frames, and publishes synchronized audio+video tracks.
"""

import asyncio
import logging
import os
import time
from pathlib import Path
from typing import Optional

import numpy as np
import yaml

from src.agent.pipeline import (
    AzureTTS,
    ConversationPipeline,
    StreamingLLM,
    WhisperSTT,
)
from src.agent.state_machine import AvatarState, AvatarStateMachine
from src.avatar.base import AudioChunk, AvatarConfig
from src.avatar.idle_controller import IdleController
from src.avatar.musetalk_engine import MuseTalkConfig, MuseTalkEngine
from src.streaming.audio_sync import AudioVideoSync
from src.streaming.video_publisher import VideoPublisher
from src.utils.audio_utils import AudioAccumulator, pcm16_to_float32
from src.utils.vad import SileroVADWrapper

logger = logging.getLogger(__name__)


class AvatarAgent:
    """
    Main avatar agent that orchestrates the entire system.

    Lifecycle:
        1. Connect to LiveKit room
        2. Initialize avatar engine, pipeline, and streaming
        3. Listen for user audio, process through pipeline
        4. Generate and publish avatar video + TTS audio
        5. Handle idle motion when not speaking
    """

    def __init__(self, config_path: str = "config/config.yaml") -> None:
        self._config = self._load_config(config_path)
        self._room = None

        # Components (initialized in start())
        self._state_machine: Optional[AvatarStateMachine] = None
        self._avatar_engine: Optional[MuseTalkEngine] = None
        self._idle_controller: Optional[IdleController] = None
        self._pipeline: Optional[ConversationPipeline] = None
        self._video_publisher: Optional[VideoPublisher] = None
        self._audio_sync: Optional[AudioVideoSync] = None
        self._vad: Optional[SileroVADWrapper] = None
        self._audio_accumulator: Optional[AudioAccumulator] = None

        # Runtime state
        self._running = False
        self._session_start_time: Optional[float] = None
        self._frame_generation_task: Optional[asyncio.Task[None]] = None
        self._user_audio_buffer: list[np.ndarray] = []

    def _load_config(self, config_path: str) -> dict:
        """Load configuration from YAML file."""
        path = Path(config_path)
        if not path.exists():
            logger.warning("Config file not found: %s, using defaults", config_path)
            return {}

        with open(path) as f:
            config = yaml.safe_load(f)

        # Expand environment variables in string values
        config = self._expand_env_vars(config)
        return config

    def _expand_env_vars(self, obj: object) -> object:
        """Recursively expand ${VAR} references in config strings."""
        if isinstance(obj, str):
            if obj.startswith("${") and obj.endswith("}"):
                var_name = obj[2:-1]
                return os.environ.get(var_name, obj)
            return obj
        elif isinstance(obj, dict):
            return {k: self._expand_env_vars(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._expand_env_vars(item) for item in obj]
        return obj

    async def start(self, room_name: Optional[str] = None) -> None:
        """
        Initialize all components and connect to LiveKit.

        Args:
            room_name: Override the room name from config.
        """
        logger.info("Starting Avatar Agent...")
        self._session_start_time = time.monotonic()

        # Initialize state machine
        sm_config = self._config.get("state_machine", {})
        self._state_machine = AvatarStateMachine(
            max_thinking_time=sm_config.get("max_thinking_time", 30.0),
            silence_threshold=sm_config.get("silence_threshold", 0.7),
        )
        self._state_machine.on_state_change(self._on_state_change)

        # Initialize avatar engine
        avatar_config = self._config.get("avatar", {})
        engine_config = AvatarConfig(
            reference_image_path=avatar_config.get(
                "reference_image", "assets/avatar_reference.png"
            ),
            output_width=avatar_config.get("output_resolution", [512, 512])[0],
            output_height=avatar_config.get("output_resolution", [512, 512])[1],
            target_fps=avatar_config.get("target_fps", 25),
            use_fp16=avatar_config.get("use_fp16", True),
            use_torch_compile=avatar_config.get("use_torch_compile", True),
        )

        mt_settings = avatar_config.get("musetalk", {})
        mt_config = MuseTalkConfig(
            model_dir=mt_settings.get("model_dir", "models/musetalk"),
            bbox_shift=mt_settings.get("bbox_shift", 5),
            batch_size=mt_settings.get("batch_size", 4),
            use_cache=mt_settings.get("use_cache", True),
            cache_dir=mt_settings.get("cache_dir", "cache/musetalk"),
        )

        self._avatar_engine = MuseTalkEngine(engine_config, mt_config)
        await self._avatar_engine.initialize()

        # Initialize idle controller
        idle_config = self._config.get("idle", {})
        self._idle_controller = IdleController(
            engine=self._avatar_engine,
            num_clips=idle_config.get("num_clips", 5),
            clip_duration_sec=idle_config.get("clip_duration_sec", 8.0),
            crossfade_frames=idle_config.get("crossfade_frames", 4),
            target_fps=engine_config.target_fps,
            randomize_order=idle_config.get("randomize_order", True),
        )
        await self._idle_controller.initialize()

        # Initialize conversation pipeline
        stt_config = self._config.get("stt", {})
        whisper_config = stt_config.get("whisper", {})
        stt = WhisperSTT(
            mode=whisper_config.get("mode", "local"),
            model_size=whisper_config.get("model_size", "large-v3"),
            language=whisper_config.get("language"),
            beam_size=whisper_config.get("beam_size", 5),
        )

        llm_config = self._config.get("llm", {})
        llm = StreamingLLM(
            provider=llm_config.get("provider", "openai"),
            model=llm_config.get("model", "gpt-4o"),
            temperature=llm_config.get("temperature", 0.7),
            max_tokens=llm_config.get("max_tokens", 1024),
            system_prompt=llm_config.get("system_prompt", ""),
        )

        tts_config = self._config.get("tts", {})
        azure_config = tts_config.get("azure", {})
        tts = AzureTTS(
            region=azure_config.get("region", "westeurope"),
            voices=azure_config.get("voices", {}),
            output_format=azure_config.get(
                "output_format", "raw-16khz-16bit-mono-pcm"
            ),
            chunk_size=azure_config.get("chunk_size", 8000),
        )

        self._pipeline = ConversationPipeline(stt, llm, tts)
        await self._pipeline.initialize()

        # Initialize VAD
        vad_config = stt_config.get("vad", {})
        self._vad = SileroVADWrapper(
            threshold=vad_config.get("threshold", 0.5),
            min_speech_duration=vad_config.get("min_speech_duration", 0.25),
            min_silence_duration=vad_config.get("min_silence_duration", 0.5),
        )
        await self._vad.initialize()

        # Audio accumulator for chunking WebRTC audio
        self._audio_accumulator = AudioAccumulator(
            chunk_size=int(0.5 * 16000),  # 0.5s chunks at 16kHz
            sample_rate=16000,
        )

        # Initialize streaming components
        lk_config = self._config.get("livekit", {})
        video_config = lk_config.get("video", {})
        self._video_publisher = VideoPublisher(
            width=video_config.get("width", 512),
            height=video_config.get("height", 512),
            fps=video_config.get("fps", 25),
        )

        audio_lk_config = lk_config.get("audio", {})
        self._audio_sync = AudioVideoSync(
            audio_sample_rate=audio_lk_config.get("sample_rate", 48000),
            video_fps=video_config.get("fps", 25),
        )

        # Connect to LiveKit
        await self._connect_livekit(
            url=lk_config.get("url", "ws://localhost:7880"),
            api_key=lk_config.get("api_key", ""),
            api_secret=lk_config.get("api_secret", ""),
            room_name=room_name or lk_config.get("room_name", "avatar-room"),
        )

        self._running = True

        # Start frame generation loop
        self._frame_generation_task = asyncio.create_task(
            self._frame_generation_loop()
        )

        logger.info("Avatar Agent started successfully")

    async def _connect_livekit(
        self, url: str, api_key: str, api_secret: str, room_name: str
    ) -> None:
        """Connect to a LiveKit room and set up event handlers."""
        try:
            from livekit import api as lk_api
            from livekit import rtc

            # Generate an access token
            token = (
                lk_api.AccessToken(api_key, api_secret)
                .with_identity("avatar-agent")
                .with_name("Avatar Agent")
                .with_grants(
                    lk_api.VideoGrants(
                        room_join=True,
                        room=room_name,
                        can_publish=True,
                        can_subscribe=True,
                    )
                )
                .to_jwt()
            )

            # Create and connect to room
            self._room = rtc.Room()

            # Register event handlers
            self._room.on("track_subscribed")(self._on_track_subscribed)
            self._room.on("participant_connected")(self._on_participant_connected)
            self._room.on("participant_disconnected")(
                self._on_participant_disconnected
            )
            self._room.on("disconnected")(self._on_disconnected)

            await self._room.connect(url, token)

            # Initialize publishers with the room
            if self._video_publisher:
                await self._video_publisher.initialize(self._room)
                await self._video_publisher.start()

            if self._audio_sync:
                await self._audio_sync.initialize(self._room)
                await self._audio_sync.start()

            logger.info("Connected to LiveKit room: %s", room_name)

        except ImportError:
            logger.error(
                "livekit package not available. "
                "Install with: pip install livekit livekit-agents"
            )
            raise

    async def _on_track_subscribed(
        self,
        track: "rtc.Track",
        publication: "rtc.TrackPublication",
        participant: "rtc.RemoteParticipant",
    ) -> None:
        """Handle new audio track from a user."""
        from livekit import rtc

        if track.kind == rtc.TrackKind.KIND_AUDIO:
            logger.info(
                "Subscribed to audio track from %s", participant.identity
            )
            audio_stream = rtc.AudioStream(track)

            asyncio.create_task(
                self._process_audio_stream(audio_stream, participant.identity)
            )

    async def _on_participant_connected(
        self, participant: "rtc.RemoteParticipant"
    ) -> None:
        """Handle new participant joining."""
        logger.info("Participant connected: %s", participant.identity)

    async def _on_participant_disconnected(
        self, participant: "rtc.RemoteParticipant"
    ) -> None:
        """Handle participant leaving."""
        logger.info("Participant disconnected: %s", participant.identity)
        if self._state_machine:
            await self._state_machine.force_idle()

    async def _on_disconnected(self) -> None:
        """Handle room disconnection."""
        logger.warning("Disconnected from LiveKit room")
        self._running = False

    async def _process_audio_stream(
        self, audio_stream: "rtc.AudioStream", participant_id: str
    ) -> None:
        """
        Process incoming audio from a user.

        Runs VAD, accumulates speech, and triggers the conversation pipeline.
        """
        logger.info("Processing audio stream from %s", participant_id)

        async for audio_event in audio_stream:
            if not self._running:
                break

            # Convert audio frame to numpy
            frame = audio_event.frame
            audio_data = pcm16_to_float32(frame.data)

            # Run VAD
            if self._vad:
                vad_result = self._vad.process_chunk(audio_data)

                if vad_result["speech_started"] and self._state_machine:
                    await self._state_machine.handle_speech_start()

                if vad_result["is_speech"]:
                    self._user_audio_buffer.append(audio_data)

                if vad_result["speech_ended"] and self._state_machine:
                    await self._state_machine.handle_speech_end()
                    # Process accumulated speech
                    if self._user_audio_buffer:
                        full_audio = np.concatenate(self._user_audio_buffer)
                        self._user_audio_buffer.clear()
                        asyncio.create_task(
                            self._handle_user_speech(full_audio)
                        )

    async def _handle_user_speech(
        self, audio: np.ndarray
    ) -> None:
        """Process user speech through the full pipeline."""
        if not self._pipeline or not self._state_machine:
            return

        try:
            # Process through STT -> LLM -> TTS pipeline
            first_chunk = True
            last_frame_data = None

            async for tts_chunk in self._pipeline.process_speech(audio):
                if first_chunk:
                    await self._state_machine.handle_response_ready()
                    # Stop idle motion
                    if self._idle_controller and self._idle_controller.is_idle:
                        self._idle_controller.stop_idle()
                    first_chunk = False

                # Feed TTS audio to avatar engine for lip-sync
                if self._avatar_engine:
                    audio_chunk = AudioChunk(
                        data=tts_chunk.audio_data,
                        sample_rate=tts_chunk.sample_rate,
                        is_silent=False,
                    )
                    frame = await self._avatar_engine.generate_frame(audio_chunk)
                    if frame and self._video_publisher:
                        await self._video_publisher.push_frame(frame)
                        last_frame_data = frame.data

                # Publish TTS audio
                if self._audio_sync:
                    await self._audio_sync.push_audio(
                        tts_chunk.audio_data, tts_chunk.sample_rate
                    )

            # Response complete — transition to idle
            await self._state_machine.handle_response_complete()

            # Start idle motion
            if self._idle_controller:
                self._idle_controller.start_idle(last_frame_data)

        except Exception:
            logger.exception("Error processing user speech")
            if self._state_machine:
                await self._state_machine.force_idle()

    async def _frame_generation_loop(self) -> None:
        """
        Continuous frame generation loop.

        Generates idle frames when the avatar is not speaking,
        ensuring continuous video output.
        """
        fps = self._config.get("avatar", {}).get("target_fps", 25)
        frame_interval = 1.0 / fps

        while self._running:
            try:
                loop_start = time.monotonic()

                if (
                    self._state_machine
                    and self._state_machine.state
                    in (AvatarState.IDLE, AvatarState.LISTENING)
                    and self._idle_controller
                    and self._idle_controller.has_clips
                ):
                    # Generate idle frame
                    if not self._idle_controller.is_idle:
                        self._idle_controller.start_idle()

                    frame = self._idle_controller.get_next_frame()
                    if frame and self._video_publisher:
                        await self._video_publisher.push_frame(frame)

                # Maintain target FPS
                elapsed = time.monotonic() - loop_start
                sleep_time = frame_interval - elapsed
                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)
                else:
                    await asyncio.sleep(0)

            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("Error in frame generation loop")
                await asyncio.sleep(frame_interval)

    def _on_state_change(
        self, old_state: AvatarState, new_state: AvatarState
    ) -> None:
        """Handle state machine transitions."""
        logger.info("Avatar state: %s -> %s", old_state.value, new_state.value)

    async def stop(self) -> None:
        """Stop the agent and clean up all resources."""
        logger.info("Stopping Avatar Agent...")
        self._running = False

        if self._frame_generation_task:
            self._frame_generation_task.cancel()
            try:
                await self._frame_generation_task
            except asyncio.CancelledError:
                pass

        if self._video_publisher:
            await self._video_publisher.stop()

        if self._audio_sync:
            await self._audio_sync.stop()

        if self._room:
            await self._room.disconnect()

        if self._avatar_engine:
            await self._avatar_engine.cleanup()

        session_duration = (
            time.monotonic() - self._session_start_time
            if self._session_start_time
            else 0
        )
        logger.info(
            "Avatar Agent stopped. Session duration: %.1fs", session_duration
        )

    @property
    def is_running(self) -> bool:
        return self._running
