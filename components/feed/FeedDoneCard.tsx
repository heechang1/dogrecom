"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FeedDoneSummary } from "@/lib/feed-track-client-storage";
import { readDoneSummary } from "@/lib/feed-track-client-storage";

export function FeedDoneCard() {
  const router = useRouter();
  const [summary, setSummary] = useState<FeedDoneSummary | null>(null);

  useEffect(() => {
    setSummary(readDoneSummary());
  }, []);

  const nextFeed = () => {
    router.push("/feed/scan");
  };

  return (
    <div className="card flow-card max-w-md w-full mx-auto text-center space-y-5">
      <div className="text-4xl" aria-hidden>
        ✅
      </div>
      <h1 className="text-xl font-bold text-slate-900">급여 기록 완료</h1>

      {summary ? (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-left">
          <p className="text-xs text-emerald-800/80 font-medium mb-1">
            오늘 총 급여량
          </p>
          <p className="text-2xl font-bold text-emerald-900 tabular-nums">
            {summary.todayTotalG}g
          </p>
          <p className="text-sm text-slate-600 mt-2">
            이번 기록: <strong>{summary.amountG}g</strong> · {summary.foodName}
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-500">요약 정보를 불러올 수 없습니다.</p>
      )}

      <p className="text-sm text-slate-600 leading-relaxed px-1">
        좋아요! 꾸준한 기록이 건강에 도움됩니다 🐶
      </p>

      <div className="flex flex-col gap-3 pt-2">
        <Link
          href="/flow/recommend?goal=normal&need=balanced"
          className="btn btn-primary w-full py-3 rounded-xl font-semibold no-underline text-center"
        >
          메인으로 돌아가기
        </Link>
        <button
          type="button"
          className="btn w-full py-3 rounded-xl font-semibold border-2 border-blue-200 bg-white text-blue-800 hover:bg-blue-50"
          onClick={nextFeed}
        >
          다음 급여 기록하기
        </button>
      </div>
    </div>
  );
}
