
FROM python:3.10-slim AS builder

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.10-slim

LABEL maintainer="SecureScan"
LABEL description="AI-Powered Security Vulnerability Scanner"

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    GIT_PYTHON_GIT_EXECUTABLE=git

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/* && \
    git --version

COPY --from=builder /install /usr/local


RUN groupadd -r securescan && useradd -r -g securescan -d /app -s /sbin/nologin securescan


COPY --chown=securescan:securescan . .


RUN mkdir -p /tmp/scans && chown securescan:securescan /tmp/scans


USER securescan


EXPOSE 8000


HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1


CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
