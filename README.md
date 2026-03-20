# Create Virtual Executive

Web app to **generate** a six-file virtual employee (Claude “skill package”) from a written brief—using the [Virtual Employee Creator](docs/vendor/virtual-employee-creator-SKILL.md) specification—and **chat in character** with that persona via the Anthropic Messages API.

## Prerequisites

- Node 20+
- [pnpm](https://pnpm.io/)
- An [Anthropic API key](https://console.anthropic.com/)

## Local setup

```bash
cp .env.example .env
# Set ANTHROPIC_API_KEY=...

pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

The persona **Chat** page shows a React Three Fiber **glTF avatar** (default: Three.js `RobotExpressive` demo under `public/avatars/`) beside the chat. While **Speak** (TTS) plays, a **morph-target stub** animates mouth-ish shapes when the model exposes matching blend shapes. Override with `NEXT_PUBLIC_AVATAR_MODEL_URL`. WebGL loads client-only via `dynamic(..., { ssr: false })` inside `PersonaChatSection`.

Generated personas are stored under `data/personas/<id>/` (gitignored). Each persona includes:

- `SKILL.md`
- `core/identity.md`, `core/decision_engine.md`, `core/expertise.md`
- `os/protocols.md`, `os/guardrails.md`

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Server-side API key (never exposed to the browser). |
| `ANTHROPIC_MODEL` | No | Defaults to `claude-sonnet-4-20250514`. |
| `UPSTASH_REDIS_REST_URL` | No | If set with token, enables IP rate limiting on `/api/*`. |
| `UPSTASH_REDIS_REST_TOKEN` | No | Pair with URL for Upstash. |
| `ELEVENLABS_API_KEY` | No | Server-side TTS (`lib/voice/tts.ts`); pair with `ELEVENLABS_VOICE_ID`. |
| `ELEVENLABS_VOICE_ID` | No | ElevenLabs voice UUID from dashboard or `/v1/voices`. |
| `ELEVENLABS_MODEL_ID` | No | Optional TTS model (e.g. `eleven_multilingual_v2`). |
| `DEEPGRAM_API_KEY` | No | Server-side STT (`lib/voice/stt.ts`, `POST /api/stt`); required for **Mic** on the chat page. |
| `NEXT_PUBLIC_AVATAR_MODEL_URL` | No | Optional glTF/glb URL or `/avatars/...` path; defaults to bundled Three.js RobotExpressive demo. |
| `PUBLIC_BASE_URL` | No | Public origin for Twilio webhooks (e.g. `https://your-app.vercel.app`). Used for absolute `<Gather action>` URLs in TwiML and **signature verification**. |
| `TWILIO_AUTH_TOKEN` | No | When set, `POST /api/twilio/voice*` require a valid `X-Twilio-Signature` (recommended in production). |
| `TWILIO_VOICE_PERSONA_ID` | No | Default persona id for **inbound phone** (`/api/twilio/voice`). |
| `TWILIO_ACCOUNT_SID` | No | Twilio Account SID; required for **outbound** REST API. |
| `TWILIO_VOICE_FROM_NUMBER` | No | E.164 caller ID (your Twilio number); required for **outbound**. |
| `TWILIO_OUTBOUND_API_SECRET` | No | Enables `POST /api/admin/twilio/outbound` when set (`Authorization: Bearer …`). |
| `TWILIO_VOICE_BARGE_IN` | No | `false` disables nesting assistant `<Say>` inside `<Gather>` (default **on** = barge-in). |
| `PHONE_CALL_SESSION_TTL_SECONDS` | No | Redis TTL for phone transcript cache (default `86400`). Requires Upstash Redis env vars. |
| `PHONE_CALL_MAX_MESSAGES` | No | Max messages stored per call before trimming oldest (default `40`). |

With `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` set, `POST /api/tts` accepts JSON `{ "text": "..." }` and returns `audio/mpeg`. The persona chat page includes a **Speak** button on assistant messages.

With `DEEPGRAM_API_KEY` set, `POST /api/stt` accepts `multipart/form-data` with an `audio` file field (e.g. WebM from the browser **Mic** control); the JSON response is `{ "transcript": "..." }`. Max upload size matches `MAX_STT_AUDIO_BYTES` in `lib/voice/stt.ts`.

`POST /api/chat/complete` accepts JSON `{ "personaId", "messages" }` and returns `{ "text" }` (non-streaming), for integrations such as a **phone worker** or tools. Web chat should keep using streaming `POST /api/chat`.

### Inbound phone (Twilio, MVP)

1. Set `PUBLIC_BASE_URL` and `TWILIO_VOICE_PERSONA_ID` (and `ANTHROPIC_API_KEY`). Set `TWILIO_AUTH_TOKEN` so webhook requests are signature-checked.
2. Set **`UPSTASH_REDIS_REST_URL`** and **`UPSTASH_REDIS_REST_TOKEN`** (same as rate limiting) to enable **CallSid-scoped** multi-turn memory on the phone leg. Without Redis, **`<Gather action>` URLs carry `personaId=`** so outbound and single-turn flows still resolve the right executive.
3. In Twilio → Phone Numbers → **A call comes in** → Webhook **POST** → `https://YOUR_HOST/api/twilio/voice`.
4. Optional: **Call status changes** → **POST** → `https://YOUR_HOST/api/twilio/voice/status` to delete session keys when a call ends (otherwise keys expire via TTL).
5. Flow: Twilio **speech gather** → `POST /api/twilio/voice/gather` → Claude via `completeExecutiveReply` with prior turns (when Redis is on) → Twilio **`<Say>`** (Amazon Polly). With **barge-in** (default), the assistant reply and follow-up prompt are **inside one `<Gather>`** so callers can interrupt playback by speaking.

### Outbound calls (admin API)

`POST /api/admin/twilio/outbound` with header `Authorization: Bearer <TWILIO_OUTBOUND_API_SECRET>` and JSON `{ "to": "+15559876543", "personaId": "optional-id" }` starts a call to `to` using the same TwiML entrypoint as inbound (`/api/twilio/voice?personaId=…`). Requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VOICE_FROM_NUMBER`. This route is under `/api/admin/` so it **is** covered by optional Upstash IP rate limits (unlike `/api/twilio/*`).

```bash
curl -sS -X POST "$PUBLIC_BASE_URL/api/admin/twilio/outbound" \
  -H "Authorization: Bearer $TWILIO_OUTBOUND_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"to":"+15559876543"}'
```

Routes under `/api/twilio/` are **excluded** from optional Upstash `/api` rate limiting so shared Twilio IPs are not throttled.

A separate **`voice-worker/`** process handles **Twilio Media Streams** WebSockets (skeleton that parses `media` frames); see **`voice-worker/README.md`** and **`docs/twilio-media-streams.md`**.

## Optional: API rate limiting

Set both Upstash variables to limit `/api/*` by IP (sliding window: 30 requests / minute). Without them, the middleware passes requests through.

## Production notes

- **Persistence**: The MVP uses the local filesystem. Serverless hosts (e.g. Vercel) need a mounted volume or move artifact storage to object storage + Postgres metadata.
- **Auth & billing**: Add sign-in (e.g. Clerk, Auth.js) and Stripe; extend `PersonaMeta.userId` (already `null` in MVP) and scope queries by user.
- **Export**: A follow-on feature is ZIP download of the six files for Cursor / Claude Desktop.

## GitHub repository

```bash
cd create-virtual-executive
git init
git add .
git commit -m "Initial MVP: generate personas + in-app chat"
gh repo create create-virtual-executive --public --source=. --remote=origin --push
```

Use `--private` if you prefer. Requires the [GitHub CLI](https://cli.github.com/) and authentication.

## Scripts

- `pnpm dev` — development server  
- `pnpm build` — production build  
- `pnpm start` — run production build  
- `pnpm lint` — ESLint  

## License

MIT — see [LICENSE](LICENSE). Vendored Virtual Employee Creator spec remains subject to your upstream terms; see [docs/vendor/README.md](docs/vendor/README.md).
