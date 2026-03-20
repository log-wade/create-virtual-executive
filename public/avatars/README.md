# Avatar assets

## `robot-expressive.glb`

Bundled **demo** model from the [Three.js examples](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive) (`RobotExpressive.glb`). Use is subject to the **three.js** project and example asset terms; replace with your own licensed glTF for production branding.

## Custom model

1. Add `your-model.glb` under `public/avatars/`.
2. Set in `.env`:

   ```bash
   NEXT_PUBLIC_AVATAR_MODEL_URL=/avatars/your-model.glb
   ```

3. Prefer meshes with **morph targets** (e.g. visemes or mouth shapes). The lip-sync stub matches names containing `mouth`, `jaw`, `viseme`, `surprised`, etc., or falls back to the first morph target on each mesh.
