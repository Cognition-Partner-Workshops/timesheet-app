# Deployment Guide

## Prerequisites

- NVIDIA GPU with >= 12GB VRAM and CUDA 12.x drivers
- Docker with NVIDIA Container Toolkit
- API keys for: Azure Speech Services, OpenAI (or Anthropic)

## Quick Start (Docker Compose)

### 1. Clone and Configure

```bash
git clone <repo-url> live-avatar-project
cd live-avatar-project

# Copy and edit environment variables
cp config/.env.example .env
nano .env  # Fill in your API keys
```

### 2. Add Avatar Reference Image

Place your avatar reference image at `assets/avatar_reference.png`.

Requirements:
- Clear frontal face, well-lit
- Resolution: 512x512 or higher
- Format: PNG or JPG

### 3. Download MuseTalk Models

```bash
# Create model directory
mkdir -p models/musetalk

# Download MuseTalk models (see MuseTalk repo for latest links)
# https://github.com/TMElyralab/MuseTalk#download-weights
cd models/musetalk
# Follow the MuseTalk documentation for model downloads
```

### 4. Start the System

```bash
# Set your host IP for WebRTC
export HOST_IP=$(hostname -I | awk '{print $1}')

# Start LiveKit + Avatar Agent
docker-compose up -d

# View logs
docker-compose logs -f avatar-agent
```

### 5. Connect a Client

Open a browser and connect to the LiveKit room using the LiveKit
Meet app or a custom client:

```
https://meet.livekit.io/?livekit-url=ws://<YOUR_HOST_IP>:7880&token=<TOKEN>
```

Generate a token:
```bash
# Install LiveKit CLI
curl -sSL https://get.livekit.io/cli | bash

# Generate token
livekit-cli create-token \
  --api-key devkey \
  --api-secret devsecret \
  --join --room avatar-room \
  --identity user1
```

## RunPod Deployment

### 1. SSH into Your RunPod Instance

```bash
ssh root@<runpod-ip> -p <port>
```

### 2. Verify GPU

```bash
nvidia-smi
# Should show RTX 6000 Pro with 96GB VRAM
```

### 3. Install Dependencies

```bash
# Docker is usually pre-installed on RunPod
# Install NVIDIA Container Toolkit if not present
apt-get update && apt-get install -y nvidia-container-toolkit
systemctl restart docker
```

### 4. Clone and Run

```bash
git clone <repo-url> /workspace/live-avatar-project
cd /workspace/live-avatar-project

cp config/.env.example .env
# Edit .env with your API keys

export HOST_IP=$(curl -s ifconfig.me)
docker-compose up -d
```

### 5. Expose Ports

RunPod typically exposes ports via their dashboard:
- Port 7880: LiveKit WebSocket (required)
- Port 7881: LiveKit WebRTC TCP (required)
- Ports 50000-50100/UDP: WebRTC media (required for low-latency)

## Manual Deployment (Without Docker)

### 1. Install System Dependencies

```bash
apt-get update && apt-get install -y \
  python3.10 python3-pip ffmpeg git wget

pip install --upgrade pip
```

### 2. Install Python Dependencies

```bash
cd live-avatar-project
pip install -r requirements.txt
```

### 3. Start LiveKit Server

```bash
# Download LiveKit server
curl -sSL https://get.livekit.io | bash

# Start with dev mode
livekit-server --dev --bind 0.0.0.0 --node-ip $(hostname -I | awk '{print $1}')
```

### 4. Start Avatar Agent

```bash
# Load environment
source .env

# Run the agent
python -m src.main --config config/config.yaml
```

## Monitoring

### Enable Prometheus (Optional)

```bash
docker-compose --profile monitoring up -d
```

Access Prometheus at `http://<host>:9090`.

### Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `avatar_fps` | Current rendering FPS | < 20 |
| `avatar_latency_ms` | End-to-end latency | > 2000 |
| `avatar_vram_mb` | GPU memory usage | > 90% of total |
| `avatar_drift_ms` | A/V sync drift | > 150 |
| `avatar_dropped_frames` | Frames dropped | > 5% of total |

## Troubleshooting

### Common Issues

**CUDA OOM (Out of Memory)**
```
RuntimeError: CUDA out of memory
```
- Reduce `batch_size` in config
- Ensure no other GPU processes running: `nvidia-smi`
- Restart the agent to release cached memory

**WebRTC Connection Fails**
- Check firewall allows UDP 50000-50100
- Verify `HOST_IP` is the public/reachable IP
- Check LiveKit server logs: `docker-compose logs livekit`

**High Latency (> 2s)**
- Check GPU utilization: `nvidia-smi -l 1`
- Reduce Whisper model size to `medium` or `small`
- Check network latency to LLM/TTS APIs
- Enable `torch.compile` for faster inference

**Audio-Video Desync**
- Check logs for drift warnings
- Reduce avatar resolution if GPU is bottlenecked
- Ensure consistent frame rate (no CPU throttling)

**No Face Detected in Reference Image**
- Use a clear frontal face photo
- Ensure good lighting and resolution
- Try adjusting `bbox_shift` in config
