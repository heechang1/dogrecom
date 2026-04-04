"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useDogApp } from "@/components/dog-app-context";
import { BreedConfirmPanel } from "@/components/flow/breed-confirm-panel";
import { ResultFooter } from "@/components/flow/result-footer";

function RecommendQuerySync() {
  const searchParams = useSearchParams();
  const { recommendedFoods, syncRecommendFromSearchParams } = useDogApp();

  useEffect(() => {
    const g = searchParams.get("goal");
    const n = searchParams.get("need");
    if (g && n && recommendedFoods.length === 0) {
      syncRecommendFromSearchParams(g, n);
    }
  }, [
    searchParams,
    recommendedFoods.length,
    syncRecommendFromSearchParams,
  ]);

  return null;
}

export function RecommendStep() {
  const {
    age,
    weight,
    activity,
    dietNeeded,
    prompt,
    recommendGoal,
    recommendNeed,
    recommendedFoods,
    recommendedList,
    selectSnack,
    goToRecommend,
  } = useDogApp();

  const [scoreAdjust, setScoreAdjust] = useState<Record<string, number>>({});
  const [rerunBusy, setRerunBusy] = useState(false);

  const loadAdjustments = useCallback(async () => {
    try {
      const res = await fetch("/api/feedback");
      const data: unknown = await res.json();
      if (
        res.ok &&
        typeof data === "object" &&
        data !== null &&
        typeof (data as { adjustments?: unknown }).adjustments === "object" &&
        (data as { adjustments: unknown }).adjustments !== null
      ) {
        const raw = (data as { adjustments: Record<string, unknown> })
          .adjustments;
        const next: Record<string, number> = {};
        for (const [k, v] of Object.entries(raw)) {
          if (typeof v === "number" && Number.isFinite(v)) {
            next[k] = v;
          }
        }
        setScoreAdjust(next);
      }
    } catch (e) {
      console.error("[recommend-step] 피드백 조회 실패", e);
    }
  }, []);

  useEffect(() => {
    void loadAdjustments();
  }, [loadAdjustments, recommendedFoods]);

  const sendFoodFeedback = useCallback(
    async (foodId: number, feedback: "like" | "dislike") => {
      try {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ foodId: String(foodId), feedback }),
        });
        if (!res.ok) {
          console.error("[recommend-step] 피드백 전송 실패", res.status);
          return;
        }
        await loadAdjustments();
      } catch (e) {
        console.error("[recommend-step] 피드백 오류", e);
      }
    },
    [loadAdjustments]
  );

  const ageText = age ? age + "세" : "정보 미입력";
  const weightText = weight ? weight + "kg" : "정보 미입력";

  return (
    <>
      <Suspense fallback={null}>
        <RecommendQuerySync />
      </Suspense>
      <div className="card flow-card">
        <p className="flow-step-badge">1 / 3 · 추천</p>
        <p className="result-desc">
          <strong>{ageText}</strong>, 체중 <strong>{weightText}</strong>, 활동량{" "}
          <strong>{activity}</strong>
          {dietNeeded ? ", 다이어트 목표 반영" : ""} 기준으로 골랐어요.
        </p>
        <BreedConfirmPanel />
        <p className="text-sm text-gray-600 mt-2">
          사료 추천: <strong>goal</strong> {recommendGoal} · <strong>need</strong>{" "}
          {recommendNeed}
          {prompt.trim() ? " (자유 입력 반영)" : ""}
        </p>
        <p className="flow-one-action-hint mt-3">
          아래 <strong>사료</strong>는 DB·점수 기준이며, <strong>간식</strong>을
          탭하면 시뮬 화면으로 넘어갑니다.
        </p>

        {recommendedFoods.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-800 mb-2">맞춤 사료</p>
            <div className="snack-grid">
              {recommendedFoods.map(function (food, index) {
                const adj = scoreAdjust[String(food.id)] ?? 0;
                const displayScore = Math.round(food.score) + adj;
                return (
                  <div className="snack-block" key={food.id}>
                    <div className="snack-select-hit snack-select-hit-static cursor-default">
                      <span className="snack-item">
                        <span className="snack-rank">{index + 1}</span>
                        <span className="snack-body">
                          <span className="snack-body-title">{food.name}</span>
                          <span className="snack-body-reason">
                            {food.reason?.trim()
                              ? food.reason
                              : `점수 ${displayScore} · 단백질 ${food.protein}% · 지방 ${food.fat}% · 탄수 ${food.carb}%`}
                          </span>
                          {food.reason?.trim() ? (
                            <span className="text-gray-500 text-xs block mt-0.5">
                              반영 점수 {displayScore}
                              {adj !== 0 ? ` (피드백 ${adj >= 0 ? "+" : ""}${adj})` : ""}
                            </span>
                          ) : null}
                          <span className="snack-kcal text-gray-500 text-xs">
                            {food.purpose === "diet"
                              ? "다이어트용 사료"
                              : "일반 사료"}
                          </span>
                          <div className="feedback flex gap-2 pt-2 mt-1 border-t border-gray-100">
                            <button
                              type="button"
                              className="btn border border-gray-200 bg-white px-3 py-1 rounded text-base hover:bg-gray-50"
                              aria-label="좋아요"
                              onClick={() =>
                                void sendFoodFeedback(food.id, "like")
                              }
                            >
                              👍
                            </button>
                            <button
                              type="button"
                              className="btn border border-gray-200 bg-white px-3 py-1 rounded text-base hover:bg-gray-50"
                              aria-label="싫어요"
                              onClick={() =>
                                void sendFoodFeedback(food.id, "dislike")
                              }
                            >
                              👎
                            </button>
                          </div>
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mt-3">
            조건에 맞는 사료가 없습니다. 입력을 바꿔 다시 시도해 보세요.
          </p>
        )}

        <p className="text-sm font-medium text-gray-800 mt-6 mb-2">
          맞춤 간식 (시뮬레이션)
        </p>
        <div className="snack-grid">
          {recommendedList.map(function (item, index) {
            return (
              <div className="snack-block" key={item.id}>
                <button
                  type="button"
                  className="snack-select-hit"
                  onClick={function () {
                    selectSnack(item);
                  }}
                >
                  <span className="snack-item">
                    <span className="snack-rank">{index + 1}</span>
                    <span className="snack-body">
                      <span className="snack-body-title">{item.name}</span>
                      <span className="snack-body-reason">{item.reason}</span>
                      <span className="snack-kcal">
                        1회 기준 약 <strong>{item.kcal}</strong> kcal
                        <span className="snack-kcal-note">
                          {" "}
                          (하루 2회 가정)
                        </span>
                      </span>
                    </span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="recommend-next-actions mt-8 pt-6 border-t border-gray-200/80 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            className="btn btn-secondary py-3 flex-1"
            disabled={rerunBusy}
            onClick={() => {
              setRerunBusy(true);
              void goToRecommend().finally(() => setRerunBusy(false));
            }}
          >
            {rerunBusy ? "다시 불러오는 중…" : "다른 추천 보기"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-3 text-center space-x-2">
          <Link
            href="/feed?dogId=1"
            className="underline hover:text-gray-800"
          >
            기록용 QR 코드 페이지
          </Link>
          <span aria-hidden>·</span>
          <Link
            href="/food/ocr"
            className="underline hover:text-gray-800"
          >
            사료 라벨 OCR로 DB 추가
          </Link>
        </p>
      </div>
      <ResultFooter />
    </>
  );
}
