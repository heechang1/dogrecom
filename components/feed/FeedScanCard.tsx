"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { MOCK_SCANNED_FOOD } from "@/lib/feed-track-types";
import { saveScanPayload } from "@/lib/feed-track-client-storage";

export function FeedScanCard() {
  const router = useRouter();

  const goTest = () => {
    saveScanPayload(MOCK_SCANNED_FOOD);
    router.push("/feed/register");
  };

  return (
    <div className="card flow-card max-w-md w-full mx-auto">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">
        급여 기록
      </p>
      <h1 className="text-lg font-bold text-slate-900 mb-2">
        QR 코드를 스캔해주세요
      </h1>
      <p className="text-sm text-slate-600 mb-6 leading-relaxed">
        사료 포장의 QR을 인식하면 사료명과 권장 급여량이 자동으로 채워집니다.
      </p>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          className="btn w-full py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
          disabled
          aria-disabled="true"
        >
          카메라 스캔 (추후 구현)
        </button>
        <button
          type="button"
          className="btn btn-primary w-full py-3 rounded-xl font-semibold shadow-sm"
          onClick={goTest}
        >
          테스트로 진행
        </button>
      </div>

      <p className="text-[11px] text-slate-400 mt-4 text-center">
        테스트 시 샘플: {MOCK_SCANNED_FOOD.foodName}
      </p>

      <div className="mt-6 pt-4 border-t border-slate-100 text-center">
        <Link
          href="/flow/recommend?goal=normal&need=balanced"
          className="text-sm text-slate-600 underline hover:text-slate-900"
        >
          추천 화면으로
        </Link>
      </div>
    </div>
  );
}
