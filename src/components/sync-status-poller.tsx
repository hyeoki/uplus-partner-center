"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 로그인 직후 background sync가 끝날 때까지 2초마다 폴링.
 * 완료(ready=true)되면 router.refresh()로 서버 컴포넌트 재실행 → 새 데이터 로드.
 *
 * 사용처: 동기화가 필요한 페이지(/home, /customers)에 마운트.
 * `syncing` prop이 false면 아무것도 하지 않음(이미 완료된 상태).
 */
export default function SyncStatusPoller({ syncing }: { syncing: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!syncing) return;
    let cancelled = false;
    const poll = async () => {
      while (!cancelled) {
        try {
          const res = await fetch("/api/me/sync-status", { cache: "no-store" });
          if (res.ok) {
            const data = (await res.json()) as { ready?: boolean };
            if (data.ready) {
              router.refresh();
              return;
            }
          }
        } catch {
          /* network error — keep polling */
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [syncing, router]);

  return null;
}
