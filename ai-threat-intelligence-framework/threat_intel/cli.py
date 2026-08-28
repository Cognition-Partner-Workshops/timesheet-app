"""Command-line interface for the threat intelligence framework."""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from threat_intel import __version__


def main() -> None:
    """Entry point for the CLI."""
    parser = argparse.ArgumentParser(
        prog="threat-intel",
        description="AI-Driven Threat Intelligence Framework",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # serve command
    serve_parser = subparsers.add_parser("serve", help="Start the API server")
    serve_parser.add_argument("--host", default="0.0.0.0", help="Bind host")  # noqa: S104
    serve_parser.add_argument("--port", type=int, default=8000, help="Bind port")
    serve_parser.add_argument("--reload", action="store_true", help="Enable auto-reload")

    # scan command
    scan_parser = subparsers.add_parser("scan", help="Scan code for vulnerabilities")
    scan_parser.add_argument("target", help="File or directory to scan")
    scan_parser.add_argument("--output", "-o", help="Output file (JSON)")
    scan_parser.add_argument(
        "--format", choices=["json", "text"], default="text", help="Output format"
    )

    # cve command
    cve_parser = subparsers.add_parser("cve", help="Look up CVE information")
    cve_parser.add_argument("cve_id", help="CVE identifier (e.g. CVE-2024-1234)")

    args = parser.parse_args()

    if args.command == "serve":
        _run_server(args)
    elif args.command == "scan":
        asyncio.run(_run_scan(args))
    elif args.command == "cve":
        asyncio.run(_run_cve_lookup(args))
    else:
        parser.print_help()
        sys.exit(1)


def _run_server(args: argparse.Namespace) -> None:
    """Start the uvicorn API server."""
    import uvicorn

    from config.settings import get_settings

    settings = get_settings()

    from threat_intel.api.app import create_app

    app = create_app(
        database_url=settings.database_url,
        openai_api_key=settings.openai_api_key.get_secret_value(),
        openai_model=settings.openai_model,
        nvd_api_key=settings.nvd_api_key,
        github_token=settings.github_token,
        cors_origins=settings.cors_origins,
        api_prefix=settings.api_prefix,
        log_level=settings.log_level,
    )

    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        reload=args.reload,
    )


async def _run_scan(args: argparse.Namespace) -> None:
    """Run a vulnerability scan from the CLI."""
    from config.settings import get_settings

    settings = get_settings()
    api_key = settings.openai_api_key.get_secret_value()
    if not api_key:
        sys.stderr.write("Error: THREAT_INTEL_OPENAI_API_KEY environment variable required.\n")
        sys.exit(1)

    from threat_intel.analyzers.llm_analyzer import LLMAnalyzer
    from threat_intel.preprocessors.code_preprocessor import CodePreprocessor
    from threat_intel.scanners.repo_scanner import RepoScanner

    analyzer = LLMAnalyzer(api_key=api_key, model=settings.openai_model)
    preprocessor = CodePreprocessor()
    scanner = RepoScanner(analyzer=analyzer, preprocessor=preprocessor)

    target = Path(args.target)
    if target.is_dir():
        result = await scanner.scan_directory(str(target))
    elif target.is_file():
        result = await scanner.scan_file(str(target))
    else:
        sys.stderr.write(f"Error: Target not found: {args.target}\n")
        sys.exit(1)

    output = result.model_dump_json(indent=2)

    if args.format == "text":
        _print_text_report(result)
    elif args.output:
        Path(args.output).write_text(output)
        sys.stdout.write(f"Results written to {args.output}\n")
    else:
        sys.stdout.write(output + "\n")


def _print_text_report(result: object) -> None:
    """Print a human-readable scan report."""
    from threat_intel.models.domain import ScanResult

    if not isinstance(result, ScanResult):
        return

    sys.stdout.write(f"\n{'=' * 60}\n")
    sys.stdout.write(f"Scan Result: {result.target}\n")
    sys.stdout.write(f"Status: {result.status.value}\n")
    sys.stdout.write(f"Files scanned: {result.files_scanned}\n")
    sys.stdout.write(f"Vulnerabilities found: {result.vulnerability_count}\n")
    sys.stdout.write(f"  Critical: {result.critical_count}\n")
    sys.stdout.write(f"  High: {result.high_count}\n")
    if result.duration_seconds:
        sys.stdout.write(f"Duration: {result.duration_seconds:.2f}s\n")
    sys.stdout.write(f"{'=' * 60}\n\n")

    for i, vuln in enumerate(result.vulnerabilities, 1):
        sys.stdout.write(f"[{i}] {vuln.severity.value.upper()} - {vuln.title}\n")
        sys.stdout.write(f"    Type: {vuln.vulnerability_type.value}\n")
        sys.stdout.write(f"    Confidence: {vuln.confidence:.0%}\n")
        if vuln.file_path:
            sys.stdout.write(f"    File: {vuln.file_path}")
            if vuln.line_start:
                sys.stdout.write(f":{vuln.line_start}")
            sys.stdout.write("\n")
        sys.stdout.write(f"    {vuln.description}\n\n")

    for i, mit in enumerate(result.mitigations, 1):
        sys.stdout.write(f"Mitigation [{i}]: {mit.title}\n")
        sys.stdout.write(f"  Priority: {mit.priority}/5\n")
        sys.stdout.write(f"  {mit.description}\n")
        if mit.suggested_fix:
            sys.stdout.write(f"  Fix:\n{mit.suggested_fix}\n")
        sys.stdout.write("\n")


async def _run_cve_lookup(args: argparse.Namespace) -> None:
    """Look up a CVE from the CLI."""
    from config.settings import get_settings
    from threat_intel.collectors.nvd_collector import NVDCollector

    settings = get_settings()
    collector = NVDCollector(api_key=settings.nvd_api_key)
    record = await collector.fetch_single_cve(args.cve_id)

    if record is None:
        sys.stderr.write(f"CVE {args.cve_id} not found.\n")
        sys.exit(1)

    sys.stdout.write(record.model_dump_json(indent=2) + "\n")


if __name__ == "__main__":
    main()
