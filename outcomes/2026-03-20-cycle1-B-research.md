# 2026-03-20 Cycle 1 - Phase B Research (Provider Selection)

## Assumptions

- MVP prioritizes implementation speed and conversational responsiveness over deep media customization.
- Web and phone adapters will be server-side first, with secrets kept out of the browser.
- Phone integration targets Twilio media streams, so telephony codec/transcoding compatibility matters.
- Pricing and latency notes are directional and should be validated against current vendor pricing pages before final commitment.

## TTS Decision Matrix

| Provider | Streaming support | PSTN compatibility | Latency profile | Pricing orientation | Node ergonomics | Notes |
|---|---|---|---|---|---|---|
| ElevenLabs | Strong realtime streaming | Usually PCM output; transcode to `pcmu/8k` for Twilio | Very good for interactive voice | Mid-premium | Good JS SDK | Best voice quality + fast MVP setup |
| OpenAI TTS | Streaming supported by modern APIs | PCM/WAV path; transcode for PSTN | Good | Mid | Strong JS docs/SDK | Good consolidation option |
| Google Cloud TTS | Reliable synthesis APIs | Straightforward linear16 -> PSTN transcode | Predictable moderate | Mid | Mature clients, more setup | Enterprise reliability |
| Amazon Polly | Real-time chunking patterns possible | Telephony-friendly formats + easy transcode | Stable moderate | Often cost-efficient | Mature AWS SDK, heavier config | Strong phone-first fit |

## STT Decision Matrix

| Provider | Streaming support | PSTN compatibility | Latency profile | Pricing orientation | Node ergonomics | Notes |
|---|---|---|---|---|---|---|
| Deepgram | Excellent streaming STT | Strong telephony path with Twilio | Very low | Competitive | Very good WS/Node flow | Best default for realtime calls |
| Google STT v2 | Mature streaming STT | Robust telephony codec handling | Low-moderate | Mid | Good SDK, more platform setup | Safe enterprise fallback |
| AssemblyAI | Streaming + async | Works with normalized/transcoded audio | Good | Mid | Good API ergonomics | Great if analytics features matter |
| OpenAI Realtime/STT | Strong realtime options | PCM-first; transcode bridge needed | Good | Mid-premium | Excellent JS ergonomics | Good single-vendor path |

## Recommended MVP Stack

- **Default:** ElevenLabs (TTS) + Deepgram (STT) + Twilio media streams.
- **Runner-up:** OpenAI-consolidated voice stack (TTS + STT/realtime) when reducing vendor count is more important than best-in-class per layer.

## Why now / why later

- **Now:** Maximize speed-to-first-call and perceived voice quality with specialized providers.
- **Later:** Revisit consolidation and cost optimization after measuring real call volume, latency, and failure patterns.

## Integration notes for this repo

- Add server-side wrappers in `lib/voice/*` and expose via `app/api/*` routes.
- Extend `.env.example` and typed config accessors for voice provider keys.
- Reuse existing API middleware/rate-limit patterns for new voice endpoints.
- Keep provider clients centralized and expose vendor-neutral interfaces (`synthesizeSpeech`, `transcribe*`) to reduce lock-in.
