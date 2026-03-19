import { NextResponse } from "next/server";

import { loadTemplates } from "@/lib/templates";

export async function GET() {
  const templates = await loadTemplates();
  return NextResponse.json({ templates });
}
