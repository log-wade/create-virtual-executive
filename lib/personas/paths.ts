import { join } from "node:path";

export function getPersonasRoot(): string {
  return join(process.cwd(), "data", "personas");
}

export function getPersonaDir(id: string): string {
  return join(getPersonasRoot(), id);
}

export function getIndexPath(): string {
  return join(getPersonasRoot(), "index.json");
}
