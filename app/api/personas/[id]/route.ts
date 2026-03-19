import { NextResponse } from "next/server";

import { getPersonaMeta, loadPersonaPackage } from "@/lib/personas/store";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const meta = await getPersonaMeta(id);
  if (!meta) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const pkg = await loadPersonaPackage(id);
  if (!pkg) {
    return NextResponse.json({ error: "Package missing" }, { status: 404 });
  }
  const preview = pkg["SKILL.md"].slice(0, 2000);
  return NextResponse.json({ meta, previewSkillMd: preview });
}
