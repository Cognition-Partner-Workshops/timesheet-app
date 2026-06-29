#!/usr/bin/env python3
"""CLI entrypoint for the InSync PostgreSQL import pipeline."""

from src.loaders.orchestrator import main

if __name__ == "__main__":
    main()
