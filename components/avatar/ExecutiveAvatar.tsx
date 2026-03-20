"use client";

import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { Box3, Mesh, Object3D, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import {
  collectMorphLipTargets,
  type MorphLipTarget,
} from "@/lib/avatar/morph-lip-sync";

const DEFAULT_MODEL_URL = "/avatars/robot-expressive.glb";

export type ExecutiveAvatarProps = {
  /** True while assistant TTS audio is playing (drives morph stub). */
  isSpeaking?: boolean;
  /**
   * glTF/glb URL (path under `public/` or absolute). Override with
   * `NEXT_PUBLIC_AVATAR_MODEL_URL` for a custom executive model.
   */
  modelUrl?: string;
};

function PlaceholderExecutive() {
  return (
    <mesh castShadow receiveShadow position={[0, 0, 0]}>
      <capsuleGeometry args={[0.38, 1.1, 10, 24]} />
      <meshStandardMaterial
        color="#4f46e5"
        metalness={0.25}
        roughness={0.45}
      />
    </mesh>
  );
}

function useResolvedModelUrl(propUrl?: string): string {
  return useMemo(() => {
    const env = process.env.NEXT_PUBLIC_AVATAR_MODEL_URL?.trim();
    if (propUrl?.trim()) return propUrl.trim();
    if (env) return env;
    return DEFAULT_MODEL_URL;
  }, [propUrl]);
}

function LipSyncDriver({
  root,
  isSpeaking,
}: {
  root: Object3D;
  isSpeaking: boolean;
}) {
  const targetsRef = useRef<MorphLipTarget[]>([]);

  useLayoutEffect(() => {
    targetsRef.current = collectMorphLipTargets(root);
  }, [root]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const flap = isSpeaking
      ? 0.22 + 0.48 * Math.abs(Math.sin(t * 12.5))
      : 0;

    for (const { mesh, indices } of targetsRef.current) {
      const infl = mesh.morphTargetInfluences;
      if (!infl) continue;
      for (const i of indices) {
        // Three.js morph targets are mutable GPU state; not React state.
        // eslint-disable-next-line react-hooks/immutability -- drive morphTargetInfluences per frame
        infl[i] = flap;
      }
    }
  });

  return null;
}

function GltfExecutive({
  url,
  isSpeaking,
}: {
  url: string;
  isSpeaking: boolean;
}) {
  const gltf = useLoader(GLTFLoader, url);
  const root = useMemo(() => gltf.scene.clone(true), [gltf]);

  useLayoutEffect(() => {
    root.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    root.position.set(0, 0, 0);
    root.scale.set(1, 1, 1);
    root.rotation.set(0, 0, 0);
    root.updateMatrixWorld(true);

    const box = new Box3().setFromObject(root);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
    const targetHeight = 1.85;
    const s = targetHeight / maxDim;
    root.scale.setScalar(s);
    root.position.sub(center.multiplyScalar(s));
  }, [root]);

  return (
    <>
      <primitive object={root} />
      <LipSyncDriver root={root} isSpeaking={isSpeaking} />
    </>
  );
}

function Scene({
  modelUrl,
  isSpeaking,
}: {
  modelUrl: string;
  isSpeaking: boolean;
}) {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight
        castShadow
        intensity={1.1}
        position={[3.5, 6, 4]}
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight intensity={0.35} position={[-4, 2, -2]} />
      <Suspense fallback={<PlaceholderExecutive />}>
        <group position={[0, -0.92, 0]}>
          <GltfExecutive url={modelUrl} isSpeaking={isSpeaking} />
        </group>
      </Suspense>
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -1.15, 0]}
      >
        <planeGeometry args={[6, 6]} />
        <shadowMaterial opacity={0.2} />
      </mesh>
    </>
  );
}

export default function ExecutiveAvatar({
  isSpeaking = false,
  modelUrl: modelUrlProp,
}: ExecutiveAvatarProps) {
  const modelUrl = useResolvedModelUrl(modelUrlProp);

  return (
    <div className="flex h-[min(420px,50vh)] min-h-[280px] w-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="border-b border-zinc-200 px-3 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        Executive (glTF + lip-sync stub)
      </p>
      <div className="relative min-h-0 flex-1">
        <Canvas
          className="size-full"
          shadows
          camera={{ position: [0, 0.35, 2.85], fov: 42 }}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
          }}
          onCreated={({ gl, scene }) => {
            gl.setClearColor(0x000000, 0);
            scene.background = null;
          }}
        >
          <Scene modelUrl={modelUrl} isSpeaking={isSpeaking} />
        </Canvas>
      </div>
    </div>
  );
}

useLoader.preload(GLTFLoader, DEFAULT_MODEL_URL);
