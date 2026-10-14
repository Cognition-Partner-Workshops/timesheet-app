"""
Avatar State Machine - Manages transitions between conversation states.

States:
    LISTENING  - User is speaking, avatar shows attentive idle motion
    THINKING   - Processing user input (STT -> LLM), avatar shows thinking motion
    SPEAKING   - Avatar is talking with lip-sync
    IDLE       - No active conversation, avatar shows natural idle motion
"""

import asyncio
import enum
import logging
import time
from typing import Callable, Optional

logger = logging.getLogger(__name__)


class AvatarState(enum.Enum):
    """Possible states for the avatar."""
    LISTENING = "listening"
    THINKING = "thinking"
    SPEAKING = "speaking"
    IDLE = "idle"


# Valid state transitions
VALID_TRANSITIONS: dict[AvatarState, set[AvatarState]] = {
    AvatarState.IDLE: {AvatarState.LISTENING},
    AvatarState.LISTENING: {AvatarState.THINKING, AvatarState.IDLE},
    AvatarState.THINKING: {AvatarState.SPEAKING, AvatarState.IDLE},
    AvatarState.SPEAKING: {AvatarState.IDLE, AvatarState.LISTENING},
}

# Type alias for state change callbacks
StateChangeCallback = Callable[[AvatarState, AvatarState], None]


class AvatarStateMachine:
    """
    Manages the avatar's conversation state and transitions.

    Enforces valid transitions and notifies listeners on state changes.
    Handles timeouts for the THINKING state to prevent getting stuck.
    """

    def __init__(
        self,
        max_thinking_time: float = 30.0,
        silence_threshold: float = 0.7,
    ) -> None:
        self._state = AvatarState.IDLE
        self._max_thinking_time = max_thinking_time
        self._silence_threshold = silence_threshold
        self._state_entered_at = time.monotonic()
        self._callbacks: list[StateChangeCallback] = []
        self._lock = asyncio.Lock()
        self._thinking_timeout_task: Optional[asyncio.Task[None]] = None

        logger.info("State machine initialized in IDLE state")

    @property
    def state(self) -> AvatarState:
        """Current avatar state."""
        return self._state

    @property
    def time_in_state(self) -> float:
        """Seconds spent in the current state."""
        return time.monotonic() - self._state_entered_at

    @property
    def silence_threshold(self) -> float:
        """Silence duration threshold for turn-end detection."""
        return self._silence_threshold

    def on_state_change(self, callback: StateChangeCallback) -> None:
        """Register a callback for state changes."""
        self._callbacks.append(callback)

    async def transition_to(self, new_state: AvatarState) -> bool:
        """
        Attempt to transition to a new state.

        Returns True if the transition was successful, False if invalid.
        """
        async with self._lock:
            old_state = self._state

            if new_state == old_state:
                return True

            if new_state not in VALID_TRANSITIONS.get(old_state, set()):
                logger.warning(
                    "Invalid transition: %s -> %s", old_state.value, new_state.value
                )
                return False

            self._state = new_state
            self._state_entered_at = time.monotonic()

            # Cancel thinking timeout if leaving THINKING state
            if old_state == AvatarState.THINKING and self._thinking_timeout_task:
                self._thinking_timeout_task.cancel()
                self._thinking_timeout_task = None

            # Start thinking timeout if entering THINKING state
            if new_state == AvatarState.THINKING:
                self._thinking_timeout_task = asyncio.create_task(
                    self._thinking_timeout()
                )

            logger.info(
                "State transition: %s -> %s (was in %s for %.2fs)",
                old_state.value,
                new_state.value,
                old_state.value,
                time.monotonic() - self._state_entered_at,
            )

            # Notify callbacks
            for callback in self._callbacks:
                try:
                    callback(old_state, new_state)
                except Exception:
                    logger.exception("Error in state change callback")

            return True

    async def _thinking_timeout(self) -> None:
        """Timeout handler for THINKING state — transitions to IDLE if stuck."""
        try:
            await asyncio.sleep(self._max_thinking_time)
            logger.warning(
                "Thinking timeout after %.1fs, transitioning to IDLE",
                self._max_thinking_time,
            )
            await self.transition_to(AvatarState.IDLE)
        except asyncio.CancelledError:
            pass

    async def handle_speech_start(self) -> None:
        """Called when user starts speaking."""
        if self._state == AvatarState.IDLE:
            await self.transition_to(AvatarState.LISTENING)
        elif self._state == AvatarState.SPEAKING:
            # User interrupts the avatar — barge-in
            await self.transition_to(AvatarState.LISTENING)

    async def handle_speech_end(self) -> None:
        """Called when user stops speaking (after silence threshold)."""
        if self._state == AvatarState.LISTENING:
            await self.transition_to(AvatarState.THINKING)

    async def handle_response_ready(self) -> None:
        """Called when first TTS audio chunk is ready."""
        if self._state == AvatarState.THINKING:
            await self.transition_to(AvatarState.SPEAKING)

    async def handle_response_complete(self) -> None:
        """Called when avatar finishes speaking the response."""
        if self._state == AvatarState.SPEAKING:
            await self.transition_to(AvatarState.IDLE)

    async def force_idle(self) -> None:
        """Force transition to IDLE from any state."""
        async with self._lock:
            old_state = self._state
            if old_state != AvatarState.IDLE:
                self._state = AvatarState.IDLE
                self._state_entered_at = time.monotonic()
                if self._thinking_timeout_task:
                    self._thinking_timeout_task.cancel()
                    self._thinking_timeout_task = None
                logger.info("Forced transition: %s -> IDLE", old_state.value)
                for callback in self._callbacks:
                    try:
                        callback(old_state, AvatarState.IDLE)
                    except Exception:
                        logger.exception("Error in state change callback")
