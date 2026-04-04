"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const PRESETS = [50, 100, 150] as const;

/** 하이드레이션 일치: 서버·클라이언트가 같은 문자열 사용 (window 금지). 절대 URL이 필요하면 .env에 NEXT_PUBLIC_SITE_URL 설정. */
function buildRecordUrlForQr(dogId: string): string {
  const path = `/feed?dogId=${encodeURIComponent(dogId)}`;
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ?? "";
  return base !== "" ? `${base}${path}` : path;
}

export function FeedRecordClient() {
  const searchParams = useSearchParams();
  const dogId = searchParams.get("dogId")?.trim() || "1";

  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const customAmount = useMemo(() => {
    if (!customOpen || customValue.trim() === "") {
      return null;
    }
    const n = Number(customValue.replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [customOpen, customValue]);

  const recordUrl = useMemo(() => buildRecordUrlForQr(dogId), [dogId]);

  const qrSrc = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=168x168&data=${encodeURIComponent(recordUrl)}`,
    [recordUrl]
  );

  const recordAmount = useCallback(
    async (grams: number) => {
      setBusy(true);
      setToast(null);
      try {
        const res = await fetch("/api/feed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dogId, amount: grams }),
        });
        const data: unknown = await res.json();
        if (!res.ok || typeof data !== "object" || data === null) {
          console.error("[feed-page] API 오류", res.status, data);
          setToast("기록에 실패했습니다. 다시 시도해 주세요.");
          return;
        }
        if ((data as { success?: unknown }).success !== true) {
          console.error("[feed-page] success 아님", data);
          setToast("기록에 실패했습니다. 다시 시도해 주세요.");
          return;
        }
        setToast(`오늘 ${grams}g 급여 기록 완료 👍`);
      } catch (e) {
        console.error("[feed-page] 요청 오류", e);
        setToast("네트워크 오류가 났습니다.");
      } finally {
        setBusy(false);
      }
    },
    [dogId]
  );

  return (
    <div className="feed-page min-h-screen flex flex-col items-center justify-start p-4 pt-10 pb-16">
      <div className="card flow-card w-full max-w-md">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">
          🐶 급여 기록
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          강아지 ID: <strong>{dogId}</strong>
        </p>

        <p className="text-sm font-medium text-gray-800 mb-2">
          현재 급여량 선택
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESETS.map((g) => (
            <button
              key={g}
              type="button"
              className="btn px-4 py-2 rounded-md border text-sm bg-white border-gray-200 text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              disabled={busy}
              onClick={() => {
                setCustomOpen(false);
                setCustomValue("");
                void recordAmount(g);
              }}
            >
              {g}g
            </button>
          ))}
          <button
            type="button"
            className={`btn px-4 py-2 rounded-md border text-sm ${
              customOpen
                ? "btn-primary border-transparent"
                : "bg-white border-gray-200 text-gray-800 hover:bg-gray-50"
            }`}
            disabled={busy}
            onClick={() => {
              setCustomOpen(true);
            }}
          >
            직접 입력
          </button>
        </div>

        {customOpen ? (
          <div className="mb-4">
            <label className="block text-xs text-gray-600 mb-1" htmlFor="feed-custom">
              그램 (g)
            </label>
            <input
              id="feed-custom"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              placeholder="예: 80"
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
            />
          </div>
        ) : null}

        <button
          type="button"
          className="btn btn-primary w-full py-3 text-base"
          disabled={busy || customAmount == null}
          onClick={() => customAmount != null && void recordAmount(customAmount)}
        >
          {busy ? "기록 중…" : "기록하기"}
        </button>

        {toast ? (
          <p
            className="mt-4 text-sm text-center text-gray-800 bg-emerald-50 border border-emerald-100 rounded-md py-3 px-2"
            role="status"
          >
            {toast}
          </p>
        ) : null}

        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-700 mb-2">QR로 이 화면 열기</p>
          <div className="flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrSrc}
              alt=""
              width={168}
              height={168}
              className="rounded-md border border-gray-100 bg-white"
            />
            <p className="text-xs text-gray-500 break-all text-center">
              {recordUrl}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <Link
            href="/flow/recommend?goal=normal&need=balanced"
            className="text-sm text-gray-600 underline hover:text-gray-900"
          >
            추천 화면으로
          </Link>
        </div>
      </div>
    </div>
  );
}
