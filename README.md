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
