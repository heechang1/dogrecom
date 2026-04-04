"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useDogApp } from "@/components/dog-app-context";

function flowSubtitle(pathname: string): string | null {
  if (pathname === "/flow/photo") return null;
  if (pathname === "/flow/input") return "기본 정보를 입력해 주세요";
  if (pathname === "/flow/recommend") return "1단계: 맞춤 추천 선택";
  if (pathname === "/flow/simulation") return "2단계: 급여 시뮬레이션";
  if (pathname === "/flow/alternative") return "3단계: 저칼로리 대안";
  return null;
}

export function FlowShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { authReady, isAuthenticated, logout } = useDogApp();

  if (!authReady || !isAuthenticated) {
    return null;
  }

  const sub = flowSubtitle(pathname);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-row">
          <h1 className="app-title">우리 강아지 맞춤 간식 추천</h1>
          <button
            type="button"
            className="btn-app-logout"
            onClick={() => logout()}
          >
            로그아웃
          </button>
        </div>
        {sub ? <p className="app-sub">{sub}</p> : null}
      </header>
      {children}
    </div>
  );
}
