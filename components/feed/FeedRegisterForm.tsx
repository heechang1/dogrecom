"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  FeedPeriod,
  FeedReaction,
  ScannedFoodPayload,
} from "@/lib/feed-track-types";
import {
  clearScanPayload,
  readFeedTrackPrefs,
  readScanPayload,
  saveDoneSummary,
  writeFeedTrackPrefs,
} from "@/lib/feed-track-client-storage";

const PRESET_G = [50, 100, 150] as const;

function chipClass(active: boolean): string {
  return [
    "flex-1 min-h-[44px] rounded-xl text-sm font-semibold transition-colors border-2",
    active
      ? "border-blue-600 bg-blue-50 text-blue-900"
      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
  ].join(" ");
}

export function FeedRegisterForm() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [food, setFood] = useState<ScannedFoodPayload | null>(null);
  const [period, setPeriod] = useState<FeedPeriod>("morning");
  const [amountMode, setAmountMode] = useState<number | "custom">(100);
  const [customG, setCustomG] = useState("");
  const [reaction, setReaction] = useState<FeedReaction>("good");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const p = readScanPayload();
    setFood(p);
    if (p) {
      const prefs = readFeedTrackPrefs();
      setPeriod(prefs.period);
      setReaction(prefs.reaction);
      const presetHit = PRESET_G.some((g) => g === prefs.amountG);
      if (presetHit) {
        setAmountMode(prefs.amountG as (typeof PRESET_G)[number]);
        setCustomG(
          prefs.customG != null ? String(prefs.customG) : ""
        );
      } else {
        setAmountMode("custom");
        setCustomG(
          String(prefs.customG ?? prefs.amountG ?? p.recommendedAmount)
        );
      }
    }
    setHydrated(true);
  }, []);

  const resolvedAmountG = useMemo(() => {
    if (amountMode === "custom") {
      const n = Number(customG.replace(/,/g, ""));
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    return amountMode;
  }, [amountMode, customG]);

  const submit = useCallback(async () => {
    if (!food) {
      return;
    }
    const g = resolvedAmountG;
    if (g === null) {
      setErr("급여량을 선택하거나 직접 입력해 주세요.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/feed/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dogId: "1",
          amountG: g,
          foodName: food.foodName,
          kcal: food.kcal,
          recommendedAmount: food.recommendedAmount,
          period,
          reaction,
        }),
      });
      const data: unknown = await res.json();
      const ok =
        res.ok &&
        typeof data === "object" &&
        data !== null &&
        (data as { success?: unknown }).success === true;
      if (!ok) {
        setErr("저장에 실패했습니다. 다시 시도해 주세요.");
        setBusy(false);
        return;
      }
      const todayTotalG =
        typeof (data as { todayTotalG?: unknown }).todayTotalG === "number"
          ? (data as { todayTotalG: number }).todayTotalG
          : g;

      writeFeedTrackPrefs({
        period,
        amountG: amountMode === "custom" ? g : amountMode,
        reaction,
        customG: amountMode === "custom" ? g : null,
      });

      saveDoneSummary({
        foodName: food.foodName,
        amountG: g,
        todayTotalG,
      });
      clearScanPayload();
      router.push("/feed/done");
    } catch {
      setErr("네트워크 오류가 났습니다.");
    } finally {
      setBusy(false);
    }
  }, [food, resolvedAmountG, period, reaction, amountMode, router]);

  if (!hydrated) {
    return (
      <div className="card flow-card max-w-md w-full mx-auto text-center py-10">
        <p className="text-sm text-slate-500">불러오는 중…</p>
      </div>
    );
  }

  if (food === null) {
    return (
      <div className="card flow-card max-w-md w-full mx-auto text-center">
        <p className="text-sm text-slate-600 mb-4">
          스캔된 사료 정보가 없습니다. QR 스캔부터 진행해 주세요.
        </p>
        <Link
          href="/feed/scan"
          className="btn btn-primary inline-block px-6 py-3 rounded-xl no-underline"
        >
          스캔 화면으로
        </Link>
      </div>
    );
  }

  return (
    <div className="card flow-card max-w-md w-full mx-auto space-y-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <p className="text-xs font-medium text-slate-500 mb-1">사료 정보</p>
        <p className="text-base font-bold text-slate-900">{food.foodName}</p>
        <p className="text-sm text-slate-600 mt-2">
          권장 급여량{" "}
          <strong className="text-slate-900">
            {food.recommendedAmount}g
          </strong>
          <span className="text-slate-400"> · </span>
          <span className="text-slate-500">{food.kcal} kcal/kg</span>
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-700 mb-2">급여 시간</p>
        <div className="flex gap-2">
          <button
            type="button"
            className={chipClass(period === "morning")}
            onClick={() => setPeriod("morning")}
          >
            아침
          </button>
          <button
            type="button"
            className={chipClass(period === "evening")}
            onClick={() => setPeriod("evening")}
          >
            저녁
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-700 mb-2">급여량</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_G.map((g) => (
            <button
              key={g}
              type="button"
              className={chipClass(amountMode === g)}
              onClick={() => {
                setAmountMode(g);
                setErr(null);
              }}
            >
              {g}g
            </button>
          ))}
          <button
            type="button"
            className={chipClass(amountMode === "custom")}
            onClick={() => setAmountMode("custom")}
          >
            직접입력
          </button>
        </div>
        {amountMode === "custom" ? (
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="g 단위"
            className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
            value={customG}
            onChange={(e) => {
              setCustomG(e.target.value);
              setErr(null);
            }}
          />
        ) : null}
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-700 mb-2">반응</p>
        <div className="flex gap-2">
          <button
            type="button"
            className={chipClass(reaction === "good")}
            onClick={() => setReaction("good")}
          >
            👍 잘 먹었어요
          </button>
          <button
            type="button"
            className={chipClass(reaction === "ok")}
            onClick={() => setReaction("ok")}
          >
            😐 보통
          </button>
          <button
            type="button"
            className={chipClass(reaction === "bad")}
            onClick={() => setReaction("bad")}
          >
            👎 안 먹어요
          </button>
        </div>
      </div>

      {err ? (
        <p className="text-sm text-red-600" role="alert">
          {err}
        </p>
      ) : null}

      <button
        type="button"
        className="btn btn-primary w-full py-3.5 rounded-xl font-semibold text-base disabled:opacity-60"
        disabled={busy}
        onClick={() => void submit()}
      >
        {busy ? "저장 중…" : "기록하기"}
      </button>

      <div className="text-center">
        <Link
          href="/feed/scan"
          className="text-sm text-slate-500 underline hover:text-slate-800"
        >
          다시 스캔
        </Link>
      </div>
    </div>
  );
}
