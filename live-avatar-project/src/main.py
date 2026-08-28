"""
Live Avatar Streaming System - Entry Point.

Starts the avatar agent and connects to a LiveKit room.
Handles graceful shutdown on SIGINT/SIGTERM.

Usage:
    python -m src.main
    python -m src.main --config config/config.yaml
    python -m src.main --room my-room
"""

import argparse
import asyncio
import logging
import os
import signal
import sys
from pathlib import Path

from dotenv import load_dotenv

from src.agent.livekit_agent import AvatarAgent

logger = logging.getLogger(__name__)


def setup_logging(level: str = "INFO", log_file: str = "") -> None:
    """Configure logging for the application."""
    log_format = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"

    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stdout)]

    if log_file:
        log_dir = Path(log_file).parent
        log_dir.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(log_file))

    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format=log_format,
        handlers=handlers,
    )

    # Reduce noise from third-party libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Live Avatar Streaming System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--config",
        type=str,
        default="config/config.yaml",
        help="Path to configuration file (default: config/config.yaml)",
    )
    parser.add_argument(
        "--room",
        type=str,
        default=None,
        help="Override LiveKit room name from config",
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default=None,
        help="Override log level (DEBUG, INFO, WARNING, ERROR)",
    )
    parser.add_argument(
        "--env-file",
        type=str,
        default=".env",
        help="Path to .env file (default: .env)",
    )
    return parser.parse_args()


async def run_agent(config_path: str, room_name: str | None = None) -> None:
    """Run the avatar agent with graceful shutdown handling."""
    agent = AvatarAgent(config_path=config_path)

    # Set up signal handlers for graceful shutdown
    loop = asyncio.get_running_loop()
    shutdown_event = asyncio.Event()

    def signal_handler() -> None:
        logger.info("Shutdown signal received")
        shutdown_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, signal_handler)

    try:
        await agent.start(room_name=room_name)
        logger.info("Avatar agent is running. Press Ctrl+C to stop.")

        # Wait for shutdown signal
        await shutdown_event.wait()

    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received")
    except Exception:
        logger.exception("Fatal error in avatar agent")
    finally:
        logger.info("Shutting down...")
        await agent.stop()
        logger.info("Shutdown complete")


def main() -> None:
    """Main entry point."""
    args = parse_args()

    # Load environment variables
    env_path = Path(args.env_file)
    if env_path.exists():
        load_dotenv(env_path)
        logger.info("Loaded environment from %s", env_path)
    else:
        # Also check config directory
        config_env = Path("config/.env")
        if config_env.exists():
            load_dotenv(config_env)

    # Determine log level
    log_level = args.log_level or os.environ.get("LOG_LEVEL", "INFO")

    setup_logging(level=log_level, log_file="logs/avatar_system.log")

    logger.info("=" * 60)
    logger.info("Live Avatar Streaming System v1.0.0")
    logger.info("=" * 60)
    logger.info("Config: %s", args.config)
    logger.info("Room: %s", args.room or "(from config)")

    asyncio.run(run_agent(args.config, args.room))


if __name__ == "__main__":
    main()
