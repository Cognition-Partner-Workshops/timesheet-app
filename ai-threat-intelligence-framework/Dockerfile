FROM python:3.12-slim AS base

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --no-cache-dir -e ".[dev]" 2>/dev/null || pip install --no-cache-dir .

COPY . .

RUN mkdir -p data/raw data/processed

EXPOSE 8000

ENV THREAT_INTEL_API_HOST=0.0.0.0
ENV THREAT_INTEL_API_PORT=8000

CMD ["python", "-m", "uvicorn", "threat_intel.api.app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
