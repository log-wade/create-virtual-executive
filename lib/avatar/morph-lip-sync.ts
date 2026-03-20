import type { Mesh, Object3D } from "three";

/** Morph names that often drive mouth / surprise (RobotExpressive uses `Surprised`). */
const LIP_SYNC_NAME_RE =
  /surprised|mouth|jaw|open|viseme|lip|aa|oh|o\b|speak|talk/i;

export type MorphLipTarget = {
  mesh: Mesh;
  /** Indices we are allowed to animate for the lip-sync stub */
  indices: number[];
};

/**
 * Collect meshes whose morph targets we can drive for a volume / viseme stub.
 */
export function collectMorphLipTargets(root: Object3D): MorphLipTarget[] {
  const out: MorphLipTarget[] = [];
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const dict = mesh.morphTargetDictionary;
    const infl = mesh.morphTargetInfluences;
    if (!dict || !infl?.length) return;

    const matched: number[] = [];
    for (const key of Object.keys(dict)) {
      if (LIP_SYNC_NAME_RE.test(key)) {
        matched.push(dict[key]!);
      }
    }

    if (matched.length === 0) {
      if (dict.Surprised !== undefined) matched.push(dict.Surprised);
      else if (dict.surprised !== undefined) matched.push(dict.surprised);
      else {
        const first = Object.keys(dict)[0];
        if (first !== undefined) matched.push(dict[first]!);
      }
    }

    if (matched.length > 0) {
      out.push({ mesh, indices: matched });
    }
  });
  return out;
}
