"use client";

import { useLayoutEffect, useState } from "react";
import { useDogApp } from "@/components/dog-app-context";

const BREED_OPTIONS = [
  "비숑",
  "푸들",
  "말티즈",
  "웰시코기",
  "골든 리트리버",
  "치와와",
  "믹스",
] as const;

export function BreedConfirmPanel() {
  const { flowBreedInsight, refreshRecommendationFromBreed } = useDogApp();

  const [analysisSnapshot, setAnalysisSnapshot] = useState<{
    breed: string;
    confidence: number;
  } | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [selectValue, setSelectValue] = useState<string>(BREED_OPTIONS[0]);
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  useLayoutEffect(() => {
    if (!flowBreedInsight) {
      setAnalysisSnapshot(null);
      setHasConfirmed(false);
      setIsEditing(false);
      setLoading(false);
      return;
    }
    setAnalysisSnapshot((prev) =>
      prev !== null
        ? prev
        : {
            breed: flowBreedInsight.breed,
            confidence: flowBreedInsight.confidence,
          }
    );
  }, [flowBreedInsight]);

  if (!flowBreedInsight || !analysisSnapshot) {
    return null;
  }

  const detected = analysisSnapshot;
  const pct = Math.round(
    Math.min(1, Math.max(0, detected.confidence)) * 100
  );
  const list = BREED_OPTIONS as readonly string[];

  async function handleYes() {
    setLoading(true);
    try {
      await refreshRecommendationFromBreed(detected.breed, "same");
      setHasConfirmed(true);
      setIsEditing(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmEdit() {
    const b = selectValue.trim();
    if (!b) return;
    setLoading(true);
    try {
      await refreshRecommendationFromBreed(b, "edited");
      setHasConfirmed(true);
      setIsEditing(false);
    } finally {
      setLoading(false);
    }
  }

  const appliedBreed = flowBreedInsight.breed;
  const userChangedBreed =
    hasConfirmed && appliedBreed !== detected.breed;

  return (
    <div className="mt-3 p-4 rounded-lg border border-amber-100 bg-amber-50/90 text-sm space-y-3">
      <div>
        <p className="text-xs font-medium text-amber-900/80 uppercase tracking-wide">
          사진 분석 결과
        </p>
        <p className="text-base font-medium text-amber-950 mt-1">
          {detected.breed}로 분석되었습니다 (신뢰도 {pct}%)
        </p>
      </div>

      {!hasConfirmed && !isEditing ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading}
            onClick={() => void handleYes()}
          >
            맞아요
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading}
            onClick={() => {
              setIsEditing(true);
              setSelectValue(
                list.includes(detected.breed) ? detected.breed : BREED_OPTIONS[0]
              );
            }}
          >
            아니에요
          </button>
        </div>
      ) : null}

      {isEditing && !hasConfirmed ? (
        <div className="space-y-2 pt-1 border-t border-amber-200/80">
          <label className="block text-xs text-amber-900/80" htmlFor="breed-fix">
            견종 수정
          </label>
          <select
            id="breed-fix"
            className="input w-full max-w-xs"
            value={selectValue}
            onChange={(e) => setSelectValue(e.target.value)}
          >
            {BREED_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading}
            onClick={() => void handleConfirmEdit()}
          >
            확인
          </button>
        </div>
      ) : null}

      {hasConfirmed ? (
        <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-green-900">
          <p className="font-medium">
            {userChangedBreed
              ? "수정된 견종 기준으로 추천을 다시 계산했습니다 👍"
              : "선택하신 견종으로 추천을 확정했습니다 👍"}
          </p>
          <p className="text-xs mt-1 text-green-800/90">
            적용 견종: <strong>{appliedBreed}</strong> · 아래 사료는 이 기준으로
            계산되었습니다.
          </p>
        </div>
      ) : null}

      {flowBreedInsight.strategyLine ? (
        <p className="text-xs text-amber-900/80 pt-2 border-t border-amber-200/60 leading-relaxed">
          <span className="font-medium text-amber-950">전략 요약 · </span>
          {flowBreedInsight.strategyLine}
        </p>
      ) : null}
    </div>
  );
}
