import { verifyBearerSecret } from "@/lib/admin/verify-bearer-secret";

/**
 * When `INTERNAL_VOICE_WORKER_SECRET` is set, requests that identify as the voice worker
 * (`X-Voice-Worker: 1`) must send `Authorization: Bearer <secret>`. Browser clients omit
 * the header and keep using the same routes without a token.
 */
export function voiceWorkerUnauthorized(req: Request): Response | null {
  const secret = process.env.INTERNAL_VOICE_WORKER_SECRET?.trim();
  if (!secret) return null;
  const worker = req.headers.get("x-voice-worker")?.trim() === "1";
  if (!worker) return null;
  if (verifyBearerSecret(req.headers.get("authorization"), secret)) return null;
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
