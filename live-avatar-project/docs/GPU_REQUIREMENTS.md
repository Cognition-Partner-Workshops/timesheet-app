# GPU Requirements

## Recommended Hardware

### Primary Target: NVIDIA RTX 6000 Pro (96GB VRAM)

This system is designed for and tested on:

| Component | VRAM Usage | Notes |
|-----------|-----------|-------|
| MuseTalk (UNet + VAE) | ~6 GB | FP16 inference |
| Whisper large-v3 | ~4 GB | faster-whisper with CTranslate2 |
| Idle clip cache | ~1 GB | 5 clips × 200 frames |
| PyTorch overhead | ~1 GB | CUDA context, kernels |
| **Total** | **~12 GB** | Leaves 84GB headroom |

### Minimum Requirements

| GPU | VRAM | Expected FPS | Notes |
|-----|------|-------------|-------|
| RTX 3090 | 24 GB | 25-30 | Full pipeline, FP16 |
| RTX 4090 | 24 GB | 30+ | Optimal single-GPU |
| A10 | 24 GB | 25-30 | Cloud GPU option |
| A100 40GB | 40 GB | 30+ | Datacenter, headroom for batching |
| RTX 6000 Pro | 96 GB | 30+ | Your target GPU |

### Not Supported

- GPUs with < 12GB VRAM
- CPU-only inference (too slow for real-time)
- AMD GPUs (MuseTalk requires CUDA)

## Performance Benchmarks

### Single User (RTX 6000 Pro, FP16)

| Metric | Target | Expected |
|--------|--------|----------|
| Avatar FPS | 25 | 30+ |
| Frame generation time | < 40ms | ~33ms |
| VRAM usage | < 16 GB | ~12 GB |
| STT latency | < 300ms | ~200ms |
| LLM first token | < 500ms | ~300ms |
| TTS first chunk | < 300ms | ~200ms |
| End-to-end latency | < 1.5s | ~1.0s |

### Concurrent Users

With 96GB VRAM on the RTX 6000 Pro:

| Users | VRAM per session | Total VRAM | Feasible |
|-------|-----------------|------------|----------|
| 1 | ~12 GB | 12 GB | Yes |
| 2 | ~12 GB | 24 GB | Yes (with session isolation) |
| 3 | ~12 GB | 36 GB | Yes |
| 4+ | ~12 GB | 48+ GB | Possible but needs testing |

> Note: Concurrent sessions require model instance duplication or
> careful batching. The current implementation supports single-session.

## Optimization Tips

### Enable FP16 (Default)
```yaml
# config/config.yaml
avatar:
  use_fp16: true
```

### Enable torch.compile
```yaml
avatar:
  use_torch_compile: true
```
First inference will be slower (compilation), subsequent inferences faster.

### VRAM Monitoring

The system exposes VRAM usage via Prometheus metrics. Monitor with:
```bash
nvidia-smi --query-gpu=memory.used,memory.total --format=csv -l 5
```

### GPU Memory Cleanup

Sessions automatically clean up GPU memory on disconnect. If you see
OOM errors after many sessions, restart the agent container:
```bash
docker-compose restart avatar-agent
```
