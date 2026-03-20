# 3D Avatar + Phone Voice Implementation Plan

> **For Claude:** Use @superpowers:executing-plans (or equivalent) to implement this plan task-by-task in order unless a task explicitly allows parallel work.

**Goal:** Add a shared **executive runtime** for LLM turns, then layer **web TTS/STT/3D** and **PSTN voice** without duplicating persona logic.

**Architecture:** Extract conversation + Anthropic streaming from `app/api/chat/route.ts` into `lib/executive/` (or similar). Web and telephony adapters call that module. Phone traffic uses a **long-lived voice worker** + Twilio (or chosen provider) Media Streams.

**Tech stack (baseline):** Next.js 16, existing `@anthropic-ai/sdk`, new deps TBD (`@react-three/fiber`, `three`, Twilio SDK, STT/TTS SDKs).

**Design reference:** [`2026-03-20-3d-avatar-phone-voice-design.md`](./2026-03-20-3d-avatar-phone-voice-design.md)

---

## Phase A — Executive runtime extraction (no user-visible change)

### Task A1: Add `streamExecutiveReply` (or equivalent)

**Files:**

- Create: `lib/executive/stream-reply.ts` — given `personaId`, `messages`, returns `ReadableStream<Uint8Array>` of UTF-8 text (same semantics as current chat route).
- Modify: `app/api/chat/route.ts` — delegate to `streamExecutiveReply` after validation and `loadPersonaPackage`.
- Test: manual — `pnpm dev`, existing chat UI still streams.

**Step 1:** Implement `streamExecutiveReply` by moving the `anthropic.messages.stream` loop from `app/api/chat/route.ts` into the new module; import `getAnthropic`, `getAnthropicModel`, `buildChatSystemPrompt`, `loadPersonaPackage`.

**Step 2:** Run `pnpm lint` and `pnpm build`; fix any issues.

**Step 3:** Commit: `refactor: extract executive stream helper for chat API`

---

### Task A2: Add non-streaming helper for voice workers (optional but recommended)

**Files:**

- Create or extend: `lib/executive/complete-reply.ts` — `completeExecutiveReply(personaId, messages): Promise<string>` using `anthropic.messages.create` (non-stream) for simpler phone integration v1.
- Document in code when to use stream vs complete (phone v1 may prefer complete + chunk TTS).

**Step 1:** Implement using existing `system` + message mapping pattern from chat route.

**Step 2:** Add a minimal **internal** route or script test (or unit test if test runner added later) — optional for MVP.

**Step 3:** Commit: `feat(executive): add complete reply helper for voice adapters`

---

## Phase B — Web: TTS + optional STT (before 3D)

### Task B1: Environment and provider scaffolding

**Files:**

- Modify: `.env.example` — document `TTS_API_KEY` (or provider-specific names), `STT_API_KEY`, optional `NEXT_PUBLIC_*` only if required (prefer server-side TTS to avoid key exposure).
- Modify: `lib/config.ts` — typed accessors for new keys (fail fast if feature flags on without keys).

**Step 1:** Choose initial TTS provider; add smallest wrapper `lib/voice/tts.ts` (e.g. `synthesizeSpeech(text): Promise<ArrayBuffer>`).

**Step 2:** Commit: `chore: scaffold TTS config and wrapper`

---

### Task B2: `POST /api/tts` (server-side)

**Files:**

- Create: `app/api/tts/route.ts` — JSON body `{ text, personaId? }`; returns `audio/mpeg` or `audio/wav` (pick one).
- Modify: `middleware.ts` if new route must match rate limit patterns.

**Step 1:** Implement with size limits and sanitization (max text length).

**Step 2:** Manual test with `curl`.

**Step 3:** Commit: `feat: add TTS API route`

---

### Task B3: Chat UI — play TTS for last assistant message

**Files:**

- Modify: `components/ChatPanel.tsx` — optional “Speak” control; `fetch('/api/tts')` → `URL.createObjectURL` → `Audio` play.
- Or create: `components/ChatVoiceControls.tsx` imported by `ChatPanel`.

**Step 1:** Keep default text-only UX; gate behind button to avoid surprise autoplay.

**Step 2:** Commit: `feat(web): optional TTS playback in chat`

---

### Task B4: Mic + STT → existing chat flow

**Files:**

- Create: `app/api/stt/route.ts` OR use client SDK if provider supports browser streaming securely.
- Modify: `components/ChatPanel.tsx` — record/stop, send transcript as user message.

**Step 1:** Prefer **server-side** upload of audio blob for v1 (simpler than WebSocket STT).

**Step 2:** Commit: `feat(web): speech input to chat`

---

## Phase C — Web: 3D avatar + lip-sync

### Task C1: Dependencies and canvas host

**Files:**

- Modify: `package.json` — add `@react-three/fiber`, `three`, `@types/three`.
- Create: `components/avatar/ExecutiveAvatar.tsx` — minimal scene (lights + placeholder mesh).
- Modify: `app/personas/[id]/chat/page.tsx` (or new route `.../avatar`) — render avatar beside `ChatPanel`.

**Step 1:** `pnpm install`; verify `pnpm build`.

**Step 2:** Commit: `feat(web): add R3F avatar shell on chat page`

---

### Task C2: Replace placeholder with glTF/VRM + viseme hook

**Files:**

- Add: `public/avatars/` asset (license-permitted model) or document external URL.
- Extend: `ExecutiveAvatar.tsx` — load model; expose `setVisemeWeights` or driven by `useFrame` from props.
- Modify: TTS path to supply viseme timings if provider supports; else stub with volume-based jaw until real visemes.

**Step 3:** Commit: `feat(web): glTF avatar with basic lip-sync hook`

---

## Phase D — Phone: Twilio inbound (MVP)

### Task D1: Voice worker service (separate deploy unit)

**Files:**

- Create: `apps/voice-worker/` or `voice-worker/` at repo root — small Node app with `ws` server, Twilio Media Streams protocol handling, calls `completeExecutiveReply` (extract shared code via package path or monorepo — **decision during implementation**; simplest v1: duplicate minimal fetch to internal API `POST /api/chat/complete` if you add it).
- Alternative: single `POST /api/internal/voice-turn` that returns text + TTS audio as base64 for v1 prototype (not ideal for latency).

**Step 1:** Spike: Twilio webhook answers call, plays static audio.

**Step 2:** Wire STT → `completeExecutiveReply` → TTS → stream back.

**Step 3:** Document deploy (Fly.io/Railway) in README section.

**Step 4:** Commit: `feat(phone): Twilio inbound voice worker MVP`

---

### Task D2: Barge-in and outbound

**Files:**

- Extend voice worker: detect user speech during TTS playback; cancel TTS; buffer new utterance.
- Add Twilio REST hooks for outbound campaign (authenticated admin only).

**Step 1:** Commit in small slices with feature flags.

---

## Verification (ongoing)

- `pnpm lint`
- `pnpm build`
- Manual: text chat regression after Phase A
- Manual: TTS/STT happy path after Phase B
- Manual: one inbound call smoke test after Phase D

---

## Notes

- **Serverless limits:** Vercel functions are a poor fit for **minutes-long** Twilio media streams; plan a **separate worker** process.
- **Security:** Never expose provider API keys to the browser for TTS/STT if avoidable; use server routes and short-lived session tokens for any client-side realtime APIs.
