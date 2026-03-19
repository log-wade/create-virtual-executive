import { NextResponse } from "next/server";

import { listPersonas } from "@/lib/personas/store";

export async function GET() {
  const personas = await listPersonas();
  return NextResponse.json({ personas });
}
