# Live Avatar Streaming System

Real-time, photorealistic talking avatar streamed via WebRTC using LiveKit. Supports Arabic and English conversation with natural idle motion.

## Architecture

```
[User Audio] → WebRTC → [Silero VAD] → [Whisper STT] → [GPT-4o LLM] → [Azure TTS]
                                                                              ↓
[User Browser] ← WebRTC ← [LiveKit Video+Audio Track] ← [MuseTalk Avatar Engine]
```

The avatar **never freezes** — when not speaking, it shows natural idle motion (breathing, blinking, subtle head movement) via pre-generated idle clips with cross-fade transitions.

## Quick Start

### 1. Prerequisites

- NVIDIA GPU with ≥ 12GB VRAM (tested on RTX 6000 Pro 96GB)
- Docker + NVIDIA Container Toolkit
- API keys: Azure Speech Services, OpenAI (or Anthropic)

### 2. Setup

```bash
git clone <repo-url> live-avatar-project
cd live-avatar-project

# Configure environment
cp config/.env.example .env
# Edit .env with your API keys

# Add your avatar reference image
cp /path/to/your/avatar.png assets/avatar_reference.png

# Download MuseTalk models (see docs/DEPLOYMENT.md)
mkdir -p models/musetalk
```

### 3. Run

```bash
export HOST_IP=$(hostname -I | awk '{print $1}')
docker-compose up -d
```

### 4. Connect

Generate a LiveKit token and connect via browser:

```bash
# Install LiveKit CLI
curl -sSL https://get.livekit.io/cli | bash

# Generate token
livekit-cli create-token \
  --api-key devkey --api-secret devsecret \
  --join --room avatar-room --identity user1
```

Open: `https://meet.livekit.io/?livekit-url=ws://<HOST_IP>:7880&token=<TOKEN>`

## Project Structure

```
live-avatar-project/
├── README.md
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── config/
│   ├── config.yaml            # All system settings
│   ├── .env.example           # API keys template
│   └── prometheus.yml         # Monitoring config
├── src/
│   ├── main.py                # Entry point
│   ├── agent/
│   │   ├── livekit_agent.py   # LiveKit orchestration
│   │   ├── state_machine.py   # IDLE/LISTENING/THINKING/SPEAKING
│   │   └── pipeline.py        # STT → LLM → TTS streaming pipeline
│   ├── avatar/
│   │   ├── base.py            # Abstract engine interface
│   │   ├── musetalk_engine.py # MuseTalk implementation
│   │   └── idle_controller.py # Idle motion with cross-fade
│   ├── streaming/
│   │   ├── video_publisher.py # LiveKit video track at 25 FPS
│   │   └── audio_sync.py      # A/V sync (< 100ms drift)
│   └── utils/
│       ├── vad.py             # Silero VAD wrapper
│       └── audio_utils.py     # Chunking, resampling, conversion
├── tests/
│   ├── test_idle_motion.py    # 5-min idle, cross-fade, looping
│   ├── test_latency.py        # Latency budget compliance
│   └── test_reconnection.py   # Disconnect/reconnect handling
├── docs/
│   ├── ARCHITECTURE.md        # System design & data flow
│   ├── GPU_REQUIREMENTS.md    # Hardware specs & benchmarks
│   └── DEPLOYMENT.md          # Docker, RunPod, manual setup
└── assets/
    └── avatar_reference.png   # Pre-configured avatar image
```

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Avatar Engine | **MuseTalk** | User-selected; 12GB VRAM, 30+ FPS, excellent lip-sync |
| STT | **Whisper large-v3** (faster-whisper) | Best Arabic + English accuracy |
| LLM | **GPT-4o** (streaming) | Fast, bilingual, token-streaming |
| TTS | **Azure Neural TTS** | High-quality Arabic (`ar-SA-HamedNeural`) + English (`en-US-JennyNeural`) |
| Streaming | **LiveKit** (self-hosted) | Open-source WebRTC SFU, Python SDK |
| VAD | **Silero** | Lightweight, streaming-compatible |
| GPU | **RTX 6000 Pro 96GB** | Target hardware (12GB used) |

## Idle Motion System

The avatar must never appear as a frozen photo. The idle system:

1. Pre-generates 5 idle clips (8 seconds each) from silent audio
2. Cross-fades (4 frames / 160ms) when transitioning from speaking to idle
3. Cuts immediately when transitioning from idle to speaking (natural behavior)
4. Randomizes clip order to prevent visible repetition
5. Loops continuously — tested for 5+ minutes without freezing

## Latency Budget

| Stage | Budget | Expected |
|-------|--------|----------|
| STT (Whisper) | < 300ms | ~200ms |
| LLM first token | < 500ms | ~300ms |
| TTS first chunk | < 300ms | ~200ms |
| Avatar first frame | < 400ms | ~33ms/frame |
| **Total** | **< 1.5s** | **~1.0s** |

## Configuration

All settings in `config/config.yaml`. Key sections:

- `avatar`: Engine selection, resolution, FPS, model paths
- `idle`: Clip count, duration, cross-fade settings
- `stt`: Whisper model, language detection, VAD
- `llm`: Provider, model, system prompt (bilingual)
- `tts`: Azure voices for Arabic and English
- `livekit`: Server URL, room settings, track encoding

## Testing

```bash
# Run all tests
pytest tests/ -v

# Specific test suites
pytest tests/test_idle_motion.py -v    # Idle motion (5-min test)
pytest tests/test_latency.py -v        # Latency & audio utilities
pytest tests/test_reconnection.py -v   # Reconnection handling
```

## Monitoring

Enable Prometheus monitoring:

```bash
docker-compose --profile monitoring up -d
```

Metrics available at `http://<host>:9090`:
- `avatar_fps` — Current rendering FPS
- `avatar_latency_ms` — End-to-end latency
- `avatar_vram_mb` — GPU memory usage
- `avatar_drift_ms` — Audio-video sync drift

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — System design, data flow, state machine
- [GPU Requirements](docs/GPU_REQUIREMENTS.md) — Hardware specs, benchmarks, optimization
- [Deployment](docs/DEPLOYMENT.md) — Docker, RunPod, manual setup, troubleshooting

## License

Proprietary — All rights reserved.
