"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { ChatPanel } from "@/components/ChatPanel";

function AvatarLoadingSkeleton() {
  return (
    <div
      className="flex h-[min(420px,50vh)] min-h-[280px] w-full animate-pulse flex-col rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
      aria-hidden
    >
      <div className="h-9 border-b border-zinc-200 dark:border-zinc-800" />
      <div className="flex-1" />
    </div>
  );
}

const ExecutiveAvatar = dynamic(
  () => import("@/components/avatar/ExecutiveAvatar"),
  {
    ssr: false,
    loading: () => <AvatarLoadingSkeleton />,
  },
);

export function PersonaChatSection({ personaId }: { personaId: string }) {
  const [avatarSpeaking, setAvatarSpeaking] = useState(false);

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(260px,320px)_1fr] lg:items-start">
      <ExecutiveAvatar isSpeaking={avatarSpeaking} />
      <ChatPanel
        personaId={personaId}
        onTtsPlaybackChange={setAvatarSpeaking}
      />
    </div>
  );
}
