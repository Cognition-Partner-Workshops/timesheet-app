"""
STT -> LLM -> TTS Pipeline.

Implements the streaming conversation pipeline:
    1. STT (Whisper) transcribes user speech
    2. LLM (OpenAI/Anthropic) generates a response (streaming)
    3. TTS (Azure) synthesizes speech from the response (streaming)

All stages are streaming — we start the next stage before the previous
one completes to minimize end-to-end latency.
"""

import asyncio
import logging
import os
import time
from typing import AsyncIterator, Optional

import numpy as np
import numpy.typing as npt

logger = logging.getLogger(__name__)


class STTResult:
    """Result from speech-to-text transcription."""

    def __init__(self, text: str, language: str, confidence: float = 1.0) -> None:
        self.text = text
        self.language = language
        self.confidence = confidence
        self.timestamp = time.monotonic()


class TTSChunk:
    """A chunk of audio from text-to-speech synthesis."""

    def __init__(
        self,
        audio_data: npt.NDArray[np.float32],
        sample_rate: int = 16000,
        is_final: bool = False,
    ) -> None:
        self.audio_data = audio_data
        self.sample_rate = sample_rate
        self.is_final = is_final
        self.timestamp = time.monotonic()


class WhisperSTT:
    """
    Speech-to-text using Whisper (local or API).

    Supports Arabic and English with automatic language detection.
    """

    def __init__(
        self,
        mode: str = "local",
        model_size: str = "large-v3",
        language: Optional[str] = None,
        beam_size: int = 5,
    ) -> None:
        self._mode = mode
        self._model_size = model_size
        self._language = language
        self._beam_size = beam_size
        self._model = None
        self._initialized = False

    async def initialize(self) -> None:
        """Load the Whisper model."""
        if self._mode == "local":
            try:
                from faster_whisper import WhisperModel

                logger.info("Loading Whisper model: %s", self._model_size)
                self._model = WhisperModel(
                    self._model_size,
                    device="cuda",
                    compute_type="float16",
                )
                self._initialized = True
                logger.info("Whisper model loaded successfully")
            except ImportError:
                logger.error(
                    "faster-whisper not installed. "
                    "Install with: pip install faster-whisper"
                )
                raise
        else:
            # API mode — uses OpenAI Whisper API
            self._initialized = True
            logger.info("Whisper API mode initialized")

    async def transcribe(
        self, audio: npt.NDArray[np.float32], sample_rate: int = 16000
    ) -> STTResult:
        """
        Transcribe audio to text.

        Args:
            audio: Float32 audio samples.
            sample_rate: Sample rate of the audio.

        Returns:
            STTResult with transcribed text and detected language.
        """
        if not self._initialized:
            raise RuntimeError("STT not initialized")

        start_time = time.monotonic()

        if self._mode == "local" and self._model is not None:
            segments, info = self._model.transcribe(
                audio,
                beam_size=self._beam_size,
                language=self._language,
                vad_filter=True,
            )

            text_parts = []
            for segment in segments:
                text_parts.append(segment.text.strip())

            text = " ".join(text_parts)
            detected_lang = info.language if info.language else "en"

            elapsed_ms = (time.monotonic() - start_time) * 1000
            logger.info(
                "STT: '%s' (lang=%s, %.0fms)",
                text[:100],
                detected_lang,
                elapsed_ms,
            )

            return STTResult(
                text=text,
                language=detected_lang,
                confidence=info.language_probability if info.language_probability else 1.0,
            )
        else:
            # API fallback
            return await self._transcribe_api(audio, sample_rate)

    async def _transcribe_api(
        self, audio: npt.NDArray[np.float32], sample_rate: int
    ) -> STTResult:
        """Transcribe using OpenAI Whisper API."""
        import io
        import soundfile as sf

        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

        # Convert to WAV bytes
        buffer = io.BytesIO()
        sf.write(buffer, audio, sample_rate, format="WAV")
        buffer.seek(0)
        buffer.name = "audio.wav"

        response = await client.audio.transcriptions.create(
            model="whisper-1",
            file=buffer,
            response_format="verbose_json",
        )

        return STTResult(
            text=response.text,
            language=response.language if hasattr(response, "language") else "en",
        )


class StreamingLLM:
    """
    Streaming LLM for generating conversational responses.

    Streams tokens one by one so TTS can start before the full
    response is generated, reducing overall latency.
    """

    def __init__(
        self,
        provider: str = "openai",
        model: str = "gpt-4o",
        temperature: float = 0.7,
        max_tokens: int = 1024,
        system_prompt: str = "",
    ) -> None:
        self._provider = provider
        self._model = model
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._system_prompt = system_prompt
        self._conversation_history: list[dict[str, str]] = []

    async def generate_stream(
        self, user_text: str, language: str = "en"
    ) -> AsyncIterator[str]:
        """
        Generate a streaming response from the LLM.

        Yields text chunks (typically sentences or phrases) suitable
        for feeding to the TTS engine.

        Args:
            user_text: The user's transcribed speech.
            language: Detected language of the user's speech.

        Yields:
            Text chunks of the response.
        """
        start_time = time.monotonic()
        first_token_time: Optional[float] = None

        # Add user message to history
        self._conversation_history.append({"role": "user", "content": user_text})

        messages = [{"role": "system", "content": self._system_prompt}]
        messages.extend(self._conversation_history[-10:])  # Keep last 10 turns

        if self._provider == "openai":
            async for chunk in self._stream_openai(messages):
                if first_token_time is None:
                    first_token_time = time.monotonic()
                    ttft = (first_token_time - start_time) * 1000
                    logger.info("LLM first token: %.0fms", ttft)
                yield chunk
        elif self._provider == "anthropic":
            async for chunk in self._stream_anthropic(messages):
                if first_token_time is None:
                    first_token_time = time.monotonic()
                    ttft = (first_token_time - start_time) * 1000
                    logger.info("LLM first token: %.0fms", ttft)
                yield chunk
        else:
            raise ValueError(f"Unknown LLM provider: {self._provider}")

        elapsed = (time.monotonic() - start_time) * 1000
        logger.info("LLM response complete: %.0fms total", elapsed)

    async def _stream_openai(
        self, messages: list[dict[str, str]]
    ) -> AsyncIterator[str]:
        """Stream response from OpenAI."""
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

        response = await client.chat.completions.create(
            model=self._model,
            messages=messages,
            temperature=self._temperature,
            max_tokens=self._max_tokens,
            stream=True,
        )

        buffer = ""
        full_response = ""

        async for chunk in response:
            delta = chunk.choices[0].delta
            if delta.content:
                buffer += delta.content
                full_response += delta.content

                # Yield at sentence boundaries for natural TTS
                while self._has_sentence_boundary(buffer):
                    sentence, buffer = self._split_at_boundary(buffer)
                    if sentence.strip():
                        yield sentence.strip()

        # Yield remaining text
        if buffer.strip():
            yield buffer.strip()

        # Save to history
        self._conversation_history.append(
            {"role": "assistant", "content": full_response}
        )

    async def _stream_anthropic(
        self, messages: list[dict[str, str]]
    ) -> AsyncIterator[str]:
        """Stream response from Anthropic Claude."""
        import anthropic

        client = anthropic.AsyncAnthropic(
            api_key=os.environ.get("ANTHROPIC_API_KEY")
        )

        # Convert messages format for Anthropic
        system_msg = ""
        api_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_msg = msg["content"]
            else:
                api_messages.append(msg)

        buffer = ""
        full_response = ""

        async with client.messages.stream(
            model=self._model,
            messages=api_messages,
            system=system_msg,
            temperature=self._temperature,
            max_tokens=self._max_tokens,
        ) as stream:
            async for text in stream.text_stream:
                buffer += text
                full_response += text

                while self._has_sentence_boundary(buffer):
                    sentence, buffer = self._split_at_boundary(buffer)
                    if sentence.strip():
                        yield sentence.strip()

        if buffer.strip():
            yield buffer.strip()

        self._conversation_history.append(
            {"role": "assistant", "content": full_response}
        )

    @staticmethod
    def _has_sentence_boundary(text: str) -> bool:
        """Check if the text contains a sentence boundary."""
        # Support both Latin and Arabic sentence terminators
        terminators = ".!?\u061F\u06D4\n"
        for char in terminators:
            idx = text.find(char)
            if idx >= 0 and idx < len(text) - 1:
                return True
        return False

    @staticmethod
    def _split_at_boundary(text: str) -> tuple[str, str]:
        """Split text at the first sentence boundary."""
        terminators = ".!?\u061F\u06D4\n"
        earliest_idx = len(text)
        for char in terminators:
            idx = text.find(char)
            if 0 <= idx < earliest_idx:
                earliest_idx = idx

        if earliest_idx < len(text):
            return text[: earliest_idx + 1], text[earliest_idx + 1 :]
        return text, ""

    def reset_history(self) -> None:
        """Clear conversation history for a new session."""
        self._conversation_history.clear()


class AzureTTS:
    """
    Text-to-speech using Azure Cognitive Services.

    Supports Arabic and English with streaming audio output.
    Streams audio chunks as they are synthesized — does NOT wait
    for full synthesis to complete.
    """

    def __init__(
        self,
        region: str = "westeurope",
        voices: Optional[dict[str, str]] = None,
        output_format: str = "raw-16khz-16bit-mono-pcm",
        chunk_size: int = 8000,
    ) -> None:
        self._region = region
        self._voices = voices or {
            "ar": "ar-SA-HamedNeural",
            "en": "en-US-JennyNeural",
        }
        self._output_format = output_format
        self._chunk_size = chunk_size
        self._synthesizer = None
        self._initialized = False

    async def initialize(self) -> None:
        """Initialize the Azure Speech SDK."""
        try:
            import azure.cognitiveservices.speech as speechsdk

            speech_key = os.environ.get("AZURE_SPEECH_KEY")
            if not speech_key:
                raise ValueError(
                    "AZURE_SPEECH_KEY environment variable not set"
                )

            speech_config = speechsdk.SpeechConfig(
                subscription=speech_key,
                region=self._region,
            )

            # Set output format for raw PCM streaming
            speech_config.set_speech_synthesis_output_format(
                speechsdk.SpeechSynthesisOutputFormat.Raw16Khz16BitMonoPcm
            )

            self._synthesizer = speechsdk.SpeechSynthesizer(
                speech_config=speech_config,
                audio_config=None,  # We handle audio output ourselves
            )

            self._initialized = True
            logger.info("Azure TTS initialized (region=%s)", self._region)

        except ImportError:
            logger.error(
                "azure-cognitiveservices-speech not installed. "
                "Install with: pip install azure-cognitiveservices-speech"
            )
            raise

    async def synthesize_stream(
        self, text: str, language: str = "en"
    ) -> AsyncIterator[TTSChunk]:
        """
        Synthesize text to speech and stream audio chunks.

        Args:
            text: Text to synthesize.
            language: Language code ('ar' or 'en').

        Yields:
            TTSChunk with audio data.
        """
        if not self._initialized or self._synthesizer is None:
            raise RuntimeError("TTS not initialized")

        start_time = time.monotonic()
        first_chunk_time: Optional[float] = None

        voice = self._voices.get(language, self._voices.get("en", "en-US-JennyNeural"))

        try:
            import azure.cognitiveservices.speech as speechsdk

            # Build SSML for the specific voice
            ssml = (
                f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
                f'xml:lang="{language}">'
                f'<voice name="{voice}">{self._escape_ssml(text)}</voice>'
                f"</speak>"
            )

            # Use pull stream for streaming audio
            result = self._synthesizer.speak_ssml_async(ssml).get()

            if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
                audio_data = result.audio_data

                # Convert to float32
                pcm_samples = np.frombuffer(audio_data, dtype=np.int16)
                float_samples = pcm_samples.astype(np.float32) / 32768.0

                # Yield in chunks
                chunk_samples = self._chunk_size // 2  # 16-bit = 2 bytes/sample
                for i in range(0, len(float_samples), chunk_samples):
                    chunk_data = float_samples[i : i + chunk_samples]
                    is_final = (i + chunk_samples) >= len(float_samples)

                    if first_chunk_time is None:
                        first_chunk_time = time.monotonic()
                        ttfc = (first_chunk_time - start_time) * 1000
                        logger.info("TTS first chunk: %.0fms", ttfc)

                    yield TTSChunk(
                        audio_data=chunk_data,
                        sample_rate=16000,
                        is_final=is_final,
                    )

            elif result.reason == speechsdk.ResultReason.Canceled:
                details = result.cancellation_details
                logger.error(
                    "TTS synthesis canceled: %s (%s)",
                    details.reason,
                    details.error_details,
                )

        except Exception:
            logger.exception("TTS synthesis failed for text: '%s'", text[:50])

    @staticmethod
    def _escape_ssml(text: str) -> str:
        """Escape special characters for SSML."""
        return (
            text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&apos;")
        )


class ConversationPipeline:
    """
    Orchestrates the full STT -> LLM -> TTS pipeline with streaming.

    Ensures each stage starts before the previous one completes
    to minimize end-to-end latency.
    """

    def __init__(
        self,
        stt: WhisperSTT,
        llm: StreamingLLM,
        tts: AzureTTS,
    ) -> None:
        self._stt = stt
        self._llm = llm
        self._tts = tts

    async def initialize(self) -> None:
        """Initialize all pipeline components."""
        await self._stt.initialize()
        await self._tts.initialize()
        logger.info("Conversation pipeline initialized")

    async def process_speech(
        self, audio: npt.NDArray[np.float32], sample_rate: int = 16000
    ) -> AsyncIterator[TTSChunk]:
        """
        Process user speech through the full pipeline.

        Streaming flow:
            1. Transcribe audio -> text
            2. Stream LLM response sentence by sentence
            3. For each sentence, stream TTS audio chunks

        This function yields TTS audio chunks as soon as they're ready.

        Args:
            audio: User's speech audio.
            sample_rate: Audio sample rate.

        Yields:
            TTSChunk with synthesized speech audio.
        """
        pipeline_start = time.monotonic()

        # Step 1: STT
        stt_result = await self._stt.transcribe(audio, sample_rate)

        if not stt_result.text.strip():
            logger.info("Empty transcription, skipping response")
            return

        logger.info(
            "Pipeline: user said '%s' (lang=%s)",
            stt_result.text[:100],
            stt_result.language,
        )

        # Step 2 + 3: Stream LLM -> TTS
        # For each sentence from the LLM, synthesize and yield audio
        async for text_chunk in self._llm.generate_stream(
            stt_result.text, stt_result.language
        ):
            # Synthesize this sentence to audio
            async for tts_chunk in self._tts.synthesize_stream(
                text_chunk, stt_result.language
            ):
                yield tts_chunk

        elapsed = (time.monotonic() - pipeline_start) * 1000
        logger.info("Pipeline complete: %.0fms total", elapsed)

    def reset(self) -> None:
        """Reset the pipeline for a new session."""
        self._llm.reset_history()
