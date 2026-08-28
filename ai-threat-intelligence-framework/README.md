# AI-Driven Threat Intelligence Framework

Real-time cyber defense against software vulnerabilities using Large Language Models (LLMs).

## Overview

This framework provides automated vulnerability detection, prediction, and mitigation for software codebases. It leverages LLMs to analyze source code in real-time, identify security vulnerabilities, and generate actionable remediation recommendations.

### Key Features

- **LLM-Powered Code Analysis**: Uses GPT-4 (or compatible models) to detect complex vulnerability patterns including SQL injection, XSS, command injection, and more
- **Real-Time Repository Scanning**: Scans entire codebases, git diffs, or individual code snippets
- **Automated Mitigation**: Generates detailed fix recommendations with code suggestions, references to OWASP/CWE standards, and effort estimates
- **CVE Intelligence**: Integrates with NVD and GitHub Security Advisories for up-to-date threat data
- **REST API**: Full-featured FastAPI service with OpenAPI documentation
- **Multi-Language Support**: Analyzes Python, JavaScript, TypeScript, Java, C/C++, Go, Rust, Ruby, PHP, C#, Swift, and Kotlin

## Architecture

```
threat_intel/
├── analyzers/        # LLM-based vulnerability analysis engine
├── collectors/       # Data ingestion from NVD, GitHub Advisories
├── preprocessors/    # Code preprocessing and chunking pipeline
├── scanners/         # Repository and git-aware scanning
├── mitigators/       # Automated remediation recommendation engine
├── models/           # Domain models and database schemas
├── api/              # FastAPI REST API layer
├── utils/            # Logging, DB, language detection utilities
└── cli.py            # Command-line interface
```

## Quick Start

### Prerequisites

- Python 3.10+
- An OpenAI API key (or compatible LLM provider)

### Installation

```bash
cd ai-threat-intelligence-framework
pip install -e ".[dev]"
```

### Configuration

Copy the environment template and configure your API keys:

```bash
cp .env.example .env
# Edit .env with your THREAT_INTEL_OPENAI_API_KEY
```

### Run the API Server

```bash
threat-intel serve
# or
uvicorn threat_intel.api.app:create_app --factory --host 0.0.0.0 --port 8000
```

API documentation is available at `http://localhost:8000/docs`.

### CLI Usage

```bash
# Scan a file or directory
threat-intel scan /path/to/code

# Look up a CVE
threat-intel cve CVE-2024-1234
```

### Docker

```bash
docker-compose up -d
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Health check |
| POST | `/api/v1/scan/code` | Scan a code snippet |
| POST | `/api/v1/scan/directory` | Scan a local directory |
| POST | `/api/v1/scan/git` | Scan a git repository |
| POST | `/api/v1/cve/search` | Search NVD for CVEs |
| GET | `/api/v1/cve/{cve_id}` | Look up a specific CVE |
| POST | `/api/v1/mitigate` | Scan code and generate mitigations |
| GET | `/api/v1/report` | Generate threat intelligence report |

## Testing

```bash
pytest
pytest --cov=threat_intel
```

## Methodology

1. **Data Collection**: Gathers vulnerability data from NVD, GitHub Security Advisories, and historical exploit databases
2. **Preprocessing**: Normalizes code into analyzable chunks with language detection, comment stripping, and overlapping windowing
3. **LLM Analysis**: Fine-tuned prompts guide the LLM to identify vulnerability patterns with type classification, severity rating, and confidence scoring
4. **Real-Time Scanning**: Monitors repositories, git diffs, and CI/CD pipelines for incoming code changes
5. **Automated Mitigation**: Generates fix recommendations using a knowledge base of OWASP guidelines, CWE references, and best practices

## Supported Vulnerability Types

- SQL Injection (CWE-89)
- Cross-Site Scripting / XSS (CWE-79)
- Command Injection (CWE-78)
- Path Traversal (CWE-22)
- Insecure Deserialization (CWE-502)
- Broken Authentication (CWE-287)
- Sensitive Data Exposure (CWE-200)
- Server-Side Request Forgery (CWE-918)
- Cross-Site Request Forgery (CWE-352)
- Cryptographic Failures (CWE-327)
- Buffer Overflow (CWE-120)
- Code Injection (CWE-94)
- And more...

## License

MIT
