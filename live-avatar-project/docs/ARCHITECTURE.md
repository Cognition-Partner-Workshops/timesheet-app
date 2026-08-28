# Architecture

## System Overview

The Live Avatar Streaming System renders a photorealistic talking avatar in real-time, streaming video and audio to users via WebRTC through LiveKit.

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Browser                             │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────────────┐  │
│  │ Mic Input │───>│ WebRTC Audio │───>│ LiveKit Client SDK    │  │
│  └──────────┘    └──────────────┘    └───────────┬───────────┘  │
│  ┌──────────┐    ┌──────────────┐                │              │
│  │ Video    │<───│ WebRTC Video │<───────────────┤              │
│  │ Display  │    └──────────────┘                │              │
│  └──────────┘    ┌──────────────┐                │              │
│  │ Speaker  │<───│ WebRTC Audio │<───────────────┘              │
│  └──────────┘    └──────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                            │ WebRTC
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LiveKit Server (Self-Hosted)                  │
│                     WebRTC SFU + Signaling                      │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Avatar Agent (GPU Server)                  │
│                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌────────────┐  │
│  │ Silero   │   │ Whisper  │   │ LLM      │   │ Azure TTS  │  │
│  │ VAD      │──>│ STT      │──>│ (GPT-4o) │──>│            │  │
│  └──────────┘   └──────────┘   └──────────┘   └─────┬──────┘  │
│                                                      │         │
│                                               ┌──────▼──────┐  │
│                                               │  MuseTalk   │  │
│  ┌────────────────┐                           │  Avatar     │  │
│  │ Idle Motion    │──────────────────────────>│  Engine     │  │
│  │ Controller     │  (silent audio when idle) └──────┬──────┘  │
│  └────────────────┘                                  │         │
│                                               ┌──────▼──────┐  │
│  ┌────────────────┐                           │  Video      │  │
│  │ A/V Sync       │<─────────────────────────│  Publisher  │  │
│  │ Controller     │                           └─────────────┘  │
│  └────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. State Machine

The avatar agent operates as a state machine with four states:

```
                    ┌───────────┐
            ┌──────>│   IDLE    │<──────┐
            │       └─────┬─────┘       │
            │             │ speech      │ response
            │             │ detected    │ complete
            │             ▼             │
            │       ┌───────────┐       │
            │       │ LISTENING │       │
            │       └─────┬─────┘       │
            │             │ silence     │
            │             │ threshold   │
            │             ▼             │
            │       ┌───────────┐       │
            │       │ THINKING  │───────┘ (timeout)
            │       └─────┬─────┘
            │             │ first TTS
            │             │ chunk ready
            │             ▼
            │       ┌───────────┐
            └───────│ SPEAKING  │
                    └───────────┘
```

- **IDLE**: Avatar shows natural idle motion (breathing, blinking)
- **LISTENING**: User is speaking; avatar shows attentive idle motion
- **THINKING**: Processing STT → LLM → TTS; avatar shows thinking motion
- **SPEAKING**: Avatar lip-syncs to TTS audio

### 2. Conversation Pipeline (Streaming)

The pipeline is fully streaming to minimize latency:

```
User speaks ──> VAD detects end ──> Whisper STT (< 300ms)
                                        │
                                        ▼
                                    LLM streaming (first token < 500ms)
                                        │ sentence by sentence
                                        ▼
                                    Azure TTS streaming (first chunk < 300ms)
                                        │ audio chunks
                                        ▼
                                    MuseTalk (first frame < 400ms)
                                        │ video frames
                                        ▼
                                    LiveKit publish (WebRTC)
```

Key: Each stage starts before the previous one completes.

### 3. Idle Motion System

The idle motion system ensures the avatar never looks frozen:

1. **Pre-generation**: During initialization, 5 idle clips (8s each) are generated by feeding silent audio to the MuseTalk model
2. **Randomized playback**: Clips play in random order to avoid visible repetition
3. **Cross-fade transitions**: 4-frame (160ms) cross-fade from speaking to idle
4. **Immediate cut**: Idle to speaking is immediate (natural behavior)

### 4. Audio-Video Synchronization

- Shared timeline between audio and video tracks
- Drift monitored continuously, target < 100ms
- Audio published at 48kHz mono (WebRTC standard)
- Video published at 25 FPS in ARGB format
- Frame queue with backpressure: drops old frames rather than desyncing audio

### 5. LiveKit Integration

- Self-hosted LiveKit server for WebRTC signaling and media relay
- Avatar agent connects as a participant with publish permissions
- Publishes one video track (avatar) and one audio track (TTS)
- Subscribes to user audio tracks for STT input
- Token-based authentication via LiveKit API

## Data Flow

### Speaking State
```
User Audio → VAD → Audio Buffer → Whisper STT → Text
    → LLM (streaming) → Sentence chunks
    → Azure TTS (streaming) → Audio chunks
    → MuseTalk → Video frames → VideoPublisher → LiveKit
    → AudioSync → LiveKit (synchronized)
```

### Idle State
```
IdleController → Pre-generated clips → VideoPublisher → LiveKit
AudioSync → Silence → LiveKit (keeps track alive)
```

## Technology Choices

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Avatar Engine | MuseTalk | 12GB VRAM, 30+ FPS, excellent lip-sync |
| STT | Whisper (faster-whisper) | Best Arabic+English accuracy |
| LLM | GPT-4o / Claude | Bilingual, fast streaming |
| TTS | Azure Neural TTS | High-quality Arabic+English voices |
| Streaming | LiveKit (self-hosted) | Low-latency WebRTC, open-source |
| VAD | Silero | Lightweight, accurate, streaming-compatible |
