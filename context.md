# Hive Context

## Current Goal

Product polish (VRM, visemes, drei) and **hardening** Media Streams (optional VAD, duplicate finals).

## Pending Tasks

- [ ] Optional - VRM, real visemes, `@react-three/drei` when deps install cleanly.
- [ ] Optional - Media Streams: VAD / Deepgram event-driven gating.

## Done (reference)

- [x] C2 - glTF + morph lip-sync stub + TTS-driven `isSpeaking` — `outcomes/2026-03-20-cycle7-C2.md`.
- [x] D1 - Twilio Gather MVP + `POST /api/chat/complete` + `voice-worker` stub — `outcomes/2026-03-20-cycle8-D1.md`.
- [x] D1-hardening - CallSid + Upstash conversation memory + optional status webhook — `outcomes/2026-03-20-cycle10-phone-session.md`.
- [x] D2 - TwiML speech barge-in + admin outbound Calls API — `outcomes/2026-03-20-cycle11-D2.md`.
- [x] Media Streams WebSocket skeleton + outbound bearer hardening — `outcomes/2026-03-20-cycle12-media-streams-skeleton.md`.
- [x] Media Streams E2E prototype (μ-law decode, Deepgram, complete + ulaw TTS outbound) — `outcomes/2026-03-20-cycle14-media-streams-pipeline.md`.
- [x] Media Streams + Upstash call memory (`callSid` on `/api/chat/complete`) — `outcomes/2026-03-20-cycle15-media-streams-call-memory.md`.
- [x] Media Streams outbound barge-in (energy gate + grace) — `outcomes/2026-03-20-cycle16-media-streams-barge-in.md`.
- [x] Media Streams Deepgram **live** STT (default) + `VOICE_STREAM_STT_MODE=rest` fallback — `outcomes/2026-03-20-cycle17-media-streams-stt-live.md`.
- [x] Deepgram live **auto-reconnect** (session id + intentional close) — `outcomes/2026-03-20-cycle18-deepgram-live-reconnect.md`.
- [x] Media Streams **half-duplex STT** during outbound TTS + `VOICE_STREAM_STT_DUPLEX=full` escape hatch — `outcomes/2026-03-20-cycle19-media-streams-half-duplex-stt.md`.
- [x] **Post-playback STT tail** (echo after TTS) + barge-in clears tail — `outcomes/2026-03-20-cycle20-media-streams-post-playback-stt-tail.md`.
- [x] Middleware **rate-limit bypass** for authenticated voice worker on `/api/tts` + `/api/chat/complete` — `outcomes/2026-03-20-cycle21-voice-worker-rate-limit-bypass.md`.
- [x] Voice worker **`GET /health`** + **final dedupe** tuning (`VOICE_STREAM_FINAL_DEDUPE_MS`) — `outcomes/2026-03-20-cycle22-voice-worker-health-dedupe.md`.

## Recent Outcomes

| Date | Task | Status | Result |
|------|------|--------|--------|
| 2026-03-20 | Hive bootstrap | Completed | Added `hive.config.json`, initialized `context.md`, and created `outcomes/` scaffold. |
| 2026-03-20 | A1 - Executive stream extraction | Completed | Extracted `streamExecutiveReply` and delegated `app/api/chat/route.ts`; `pnpm lint` and `pnpm build` passed. |
| 2026-03-20 | B-Research - TTS/STT matrix | Completed | Delivered provider matrix and MVP recommendation in `outcomes/2026-03-20-cycle1-B-research.md`. |
| 2026-03-20 | A2 - Complete reply helper | Completed | Added `completeExecutiveReply` via non-stream Anthropic call, verified with `pnpm lint` and `pnpm build`. |
| 2026-03-20 | A2 review gates | Completed | Spec review PASS and code review PASS with only non-blocking residual test gaps. |
| 2026-03-20 | B1 - TTS scaffolding | Completed | ElevenLabs config + `lib/voice/tts.ts`; `pnpm lint` / `pnpm build` passed. Outcome: `outcomes/2026-03-20-cycle3-B1.md`. |
| 2026-03-20 | B2 + B3 - TTS API + Speak UI | Completed | `POST /api/tts` + chat Speak control; lint/build passed. Outcome: `outcomes/2026-03-20-cycle4-B2-B3.md`. |
| 2026-03-20 | B2/B3 review | Completed | Spec + code review PASS (documented in cycle 4 outcome). |
| 2026-03-20 | B4 - Mic + STT → chat | Completed | `POST /api/stt` + Deepgram + `ChatPanel` Mic/Stop; lint/build passed. Outcome: `outcomes/2026-03-20-cycle5-B4.md`. |
| 2026-03-20 | B4 review | Completed | Spec + code review PASS (documented in cycle 5 outcome). |
| 2026-03-20 | C1 - R3F avatar shell | Completed | R3F + three on chat page via `PersonaChatSection`; lint/build passed. Outcome: `outcomes/2026-03-20-cycle6-C1.md`. |
| 2026-03-20 | C1 review | Completed | Spec + code review PASS (documented in cycle 6 outcome). |
| 2026-03-20 | C2 - glTF + lip-sync stub | Completed | RobotExpressive glb, morph driver, TTS `onTtsPlaybackChange`; lint/build passed. Outcome: `outcomes/2026-03-20-cycle7-C2.md`. |
| 2026-03-20 | C2 review | Completed | Spec + code review PASS (documented in cycle 7 outcome). |
| 2026-03-20 | D1 - Twilio Gather + complete API | Completed | `/api/twilio/voice*`, `/api/chat/complete`, middleware exempt, `voice-worker` stub. Outcome: `outcomes/2026-03-20-cycle8-D1.md`. |
| 2026-03-20 | D1 review | Completed | Documented in cycle 8 outcome (signature validation deferred). |
| 2026-03-20 | D1 signature verification | Completed | `TWILIO_AUTH_TOKEN` + HMAC-SHA1 `X-Twilio-Signature` on `/api/twilio/voice*`. Outcome: `outcomes/2026-03-20-cycle9-D1-signature.md`. |
| 2026-03-20 | Phone CallSid session (Redis) | Completed | Upstash-backed history in gather + `/api/twilio/voice/status` cleanup. Outcome: `outcomes/2026-03-20-cycle10-phone-session.md`. |
| 2026-03-20 | D2 - Barge-in + outbound | Completed | Nested Say in Gather; `personaId` on gather URL; `POST /api/admin/twilio/outbound`. Outcome: `outcomes/2026-03-20-cycle11-D2.md`. |
| 2026-03-20 | Media Streams skeleton + bearer hardening | Completed | `voice-worker` parses Twilio stream events; timing-safe outbound secret. Outcome: `outcomes/2026-03-20-cycle12-media-streams-skeleton.md`. |
| 2026-03-20 | Media Streams pipeline (cycle 14) | Completed | μ-law → Deepgram → `/api/chat/complete` → ElevenLabs `ulaw_8000` → outbound `media`; optional WS token + internal Bearer. Outcome: `outcomes/2026-03-20-cycle14-media-streams-pipeline.md`. |
| 2026-03-20 | Media Streams call memory (cycle 15) | Completed | `callSid` + `X-Voice-Worker` on `/api/chat/complete` merges/persists Upstash; worker forwards Twilio `CallSid`. Outcome: `outcomes/2026-03-20-cycle15-media-streams-call-memory.md`. |
| 2026-03-20 | Media Streams barge-in (cycle 16) | Completed | Outbound μ-law canceled on inbound speech energy after grace; env tunables. Outcome: `outcomes/2026-03-20-cycle16-media-streams-barge-in.md`. |
| 2026-03-20 | Media Streams live STT (cycle 17) | Completed | Deepgram WebSocket streaming + prefetch until open; utterance queue; `rest` batch mode retained. Outcome: `outcomes/2026-03-20-cycle17-media-streams-stt-live.md`. |
| 2026-03-20 | Deepgram live reconnect (cycle 18) | Completed | Backoff reconnect on unexpected close; `dgSessionId` avoids stale `onClose`; Twilio stop = intentional. Outcome: `outcomes/2026-03-20-cycle18-deepgram-live-reconnect.md`. |
| 2026-03-20 | Half-duplex STT (cycle 19) | Completed | No PCM to Deepgram during assistant playback unless barge-in; `STT_DUPLEX=full` restores full duplex. Outcome: `outcomes/2026-03-20-cycle19-media-streams-half-duplex-stt.md`. |
| 2026-03-20 | Post-playback STT tail (cycle 20) | Completed | `sttBlockedUntilMs` after normal TTS; barge-in + `start`/intentional close reset. Outcome: `outcomes/2026-03-20-cycle20-media-streams-post-playback-stt-tail.md`. |
| 2026-03-20 | Voice worker rate-limit bypass (cycle 21) | Completed | Edge-safe `voice-worker-middleware-auth` + middleware skip for `/api/tts` + `/api/chat/complete`. Outcome: `outcomes/2026-03-20-cycle21-voice-worker-rate-limit-bypass.md`. |
| 2026-03-20 | Health + final dedupe (cycle 22) | Completed | `GET /health` JSON; normalized + prefix duplicate suppression for Deepgram finals. Outcome: `outcomes/2026-03-20-cycle22-voice-worker-health-dedupe.md`. |

## Learnings

- Prompts complete faster when they include exact file paths, explicit verification commands, and a required outcome file path.
- Keep first cycle limited to Phase A to reduce regression risk before introducing voice and 3D features.
- Require reviewer agents to return pass/fail with concrete blocking items, not generic feedback.
- If read-only/ask-mode workers cannot write files, require full markdown deliverable in response and persist it centrally.
- Current chat route + helper both load persona package; preserve for behavior safety now, consider dedupe during A2 to reduce duplicate reads.
- Reviewer gates are effective when run immediately after implementation before opening the next phase.
- Track non-blocking test gaps in outcomes, but do not block phase progression when lint/build and reviews pass.
- `/api/tts` and `synthesizeSpeech` share `MAX_TTS_INPUT_CHARS`; keep them on one constant.
- Handle `audio.play()` rejections in the UI; autoplay policies can block playback without a user gesture (button click usually satisfies).
- For `MediaRecorder`, keep **Stop** enabled while `recording` even if other async UI states would disable **Mic** start.
- Use a ref for latest `messages` when STT completes so the transcript attaches to the current thread after async I/O.
- In Next.js 16 App Router, `dynamic(..., { ssr: false })` for WebGL must be used from a **client** component, not from a server `page.tsx`.
- For overlapping TTS clips, guard `audio.onended` with a **generation counter** so stale handlers do not flip shared UI state (e.g. avatar lip-sync).
- Driving Three.js `morphTargetInfluences` in `useFrame` is intentional mutation; document eslint exceptions where React immutability rules misfire.
- Twilio Voice `<Gather action>` URLs must be **absolute**; use `PUBLIC_BASE_URL` when the app sits behind a proxy or tunnel.
- Exclude `/api/twilio/*` from generic API rate limits so Twilio shared IPs are not starved.
- Twilio signature validation must use the **same public URL** Twilio posts to (`PUBLIC_BASE_URL` + path); mismatches cause false 403s.
- Reuse **Upstash Redis** for short-lived phone conversation state; TTL + optional status webhook avoids unbounded keys without a long-lived voice worker.
- Put **`personaId` on Twilio `<Gather action>` URLs** when Redis may be absent so outbound calls and serverless cold paths still resolve the executive.
- Keep **admin-only** Twilio REST routes off `/api/twilio/` so they stay on the normal API rate-limit bucket.
- Use **timing-safe** comparison for static admin bearer tokens to avoid subtle string-equality timing leaks.
- Voice worker → Next: use **`X-Voice-Worker: 1` + Bearer** only when `INTERNAL_VOICE_WORKER_SECRET` is set so browser `/api/tts` stays unauthenticated.
- ElevenLabs **`output_format=ulaw_8000`** matches Twilio Media Streams outbound **μ-law @ 8 kHz** without re-encoding MP3 in the worker.
- **`callSid` on `/api/chat/complete`** is only honored with **`X-Voice-Worker: 1`** so browser clients cannot attach to arbitrary Twilio calls; pair with **`INTERNAL_VOICE_WORKER_SECRET`** in production.
- **Stream barge-in** uses **peak PCM per 20 ms frame** so continuous silent μ-law frames do not instantly truncate TTS; threshold and grace are env-tunable per deployment.
- **Deepgram live** connects on Twilio `start`; **prefetch** linear16 until the socket is open so early audio is not dropped; finals are **deduped** (~900 ms window) before enqueueing assistant turns.
- **Deepgram reconnect** uses a monotonic **`dgSessionId`** so closing/replacing the socket on a new Twilio `start` does not trigger backoff from the previous generation’s `onClose`.
- **Half-duplex STT** pairs with **barge-in**: user audio is dropped from Deepgram only while `outboundPlaybackActive`; energy-based barge-in flips `outboundAbortPlayback` so STT resumes before playback fully ends.
- **Post-playback STT tail** only applies when playback **completes without barge-in**; otherwise callers who interrupted would still be muted for hundreds of ms.
- With **`INTERNAL_VOICE_WORKER_SECRET`**, rate-limit bypass requires **valid Bearer** + **`X-Voice-Worker: 1`** so random clients cannot skip limits by spoofing the header alone.
- **Middleware** runs on **Edge** — do not import `node:crypto`; use **`voice-worker-middleware-auth.ts`** (UTF-8 timing-safe compare) for worker checks there.
- **Deepgram final dedupe** stores a **normalized key** (lower + collapsed whitespace) and skips **strict shorter prefixes** of the last final within the window so “Hello” after “Hello world” does not enqueue twice.
