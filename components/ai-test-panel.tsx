"use client";

import { useCallback, useEffect, useState } from "react";

type AiResult = {
  goal: string;
  need: string;
  type: string[];
};

type DbFoodRow = {
  id: number;
  name: string;
  protein: number;
  fat: number;
  carb: number;
  ingredients: string[];
  purpose: string;
  score: number;
  reason: string;
};

type FallbackRow = { name: string; reason: string };

type ApiDbBody = {
  source: "db";
  ai: AiResult;
  data: DbFoodRow[];
};

type ApiAiBody = {
  source: "ai";
  data: FallbackRow[];
};

type ErrorBody = {
  error?: string;
  raw?: string;
};

function isDbBody(x: unknown): x is ApiDbBody {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    o.source === "db" &&
    typeof o.ai === "object" &&
    o.ai !== null &&
    Array.isArray(o.data)
  );
}

function isAiBody(x: unknown): x is ApiAiBody {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return o.source === "ai" && Array.isArray(o.data);
}

async function postFeedback(
  foodId: number | string,
  feedback: "like" | "dislike",
  onDone?: () => void
) {
  try {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ foodId: String(foodId), feedback }),
    });
    if (!res.ok) {
      console.error("[ai-test-panel] 피드백 전송 실패", res.status);
      return;
    }
    onDone?.();
  } catch (e) {
    console.error("[ai-test-panel] 피드백 오류", e);
  }
}

export function AiTestPanel() {
  const [message, setMessage] = useState(
    "우리 강아지 살 좀 빼야 할 것 같아"
  );
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<ApiDbBody | ApiAiBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scoreAdjust, setScoreAdjust] = useState<Record<string, number>>({});

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
      console.error("[ai-test-panel] 피드백 조회 실패", e);
    }
  }, []);

  useEffect(() => {
    if (payload?.source === "db") {
      void loadAdjustments();
    }
  }, [payload, loadAdjustments]);

  async function handleClick() {
    setError(null);
    setPayload(null);
    setLoading(true);
    try {
      const trimmed = message.trim();
      if (!trimmed) {
        throw new Error("문장을 입력해 주세요.");
      }

      const res = await fetch("/api/ai-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      const data: unknown = await res.json();

      if (!res.ok) {
        const errObj = data as ErrorBody;
        const msg =
          typeof errObj.error === "string"
            ? errObj.error
            : `요청 실패 (${res.status})`;
        throw new Error(msg);
      }

      if (
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof (data as ErrorBody).error === "string"
      ) {
        throw new Error((data as ErrorBody).error);
      }

      if (isDbBody(data)) {
        const normalized: ApiDbBody = {
          ...data,
          data: data.data.map((row) => ({
            ...row,
            reason:
              typeof row.reason === "string" && row.reason.trim() !== ""
                ? row.reason
                : "추천 이유가 없습니다.",
          })),
        };
        console.log("[ai-test-panel] DB 응답:", normalized);
        setPayload(normalized);
        return;
      }
      if (isAiBody(data)) {
        console.log("[ai-test-panel] AI fallback 응답:", data);
        setPayload(data);
        return;
      }

      throw new Error("응답 형식이 올바르지 않습니다.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card max-w-xl mx-auto mt-8 p-6">
      <h2 className="text-lg font-semibold mb-2">AI 테스트 (GPT)</h2>
      <label className="block text-sm text-gray-600 mb-1" htmlFor="ai-msg">
        전송 문장
      </label>
      <textarea
        id="ai-msg"
        className="w-full border border-gray-200 rounded-md p-2 text-sm min-h-[80px] mb-4"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
      />
      <button
        type="button"
        className="btn btn-primary"
        disabled={loading}
        onClick={() => void handleClick()}
      >
        {loading ? "요청 중…" : "API 호출"}
      </button>
      {error ? (
        <pre className="mt-4 p-3 bg-red-50 text-red-800 rounded text-sm overflow-auto">
          {error}
        </pre>
      ) : null}
      {payload ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm">
            <span className="font-medium text-gray-700">출처: </span>
            <span className="text-gray-600">
              {payload.source === "db"
                ? "DB 추천 (점수 정렬)"
                : "AI 추천 (DB 매칭 없음)"}
            </span>
          </p>

          {payload.source === "db" ? (
            <>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">
                  AI 분석 (JSON)
                </p>
                <pre className="p-3 bg-gray-50 rounded text-sm overflow-auto">
                  {JSON.stringify(payload.ai, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">
                  추천 사료
                </p>
                {payload.data.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    조건에 맞는 사료가 없습니다.
                  </p>
                ) : (
                  <ul className="space-y-3 text-sm">
                    {payload.data.map((item) => {
                      const adj = scoreAdjust[String(item.id)] ?? 0;
                      const displayScore = Math.round(item.score) + adj;
                      return (
                      <li key={item.id} className="food-card">
                        <div className="border border-gray-100 rounded-lg p-3 bg-white space-y-2">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-gray-600 text-xs">
                            점수: {displayScore}
                            {adj !== 0
                              ? ` (피드백 반영 ${adj >= 0 ? "+" : ""}${adj})`
                              : ""}
                          </div>
                          <p className="text-gray-600 mt-1 text-xs">
                            단백질 {item.protein}% · 지방 {item.fat}% · 탄수{" "}
                            {item.carb}% · {item.purpose}
                          </p>
                          <div className="reason text-gray-700 text-sm whitespace-pre-wrap border-t border-gray-100 pt-2 mt-1">
                            {item.reason}
                          </div>
                          <div className="feedback flex gap-2 pt-1">
                            <button
                              type="button"
                              className="btn border border-gray-200 bg-white px-3 py-1 rounded text-base hover:bg-gray-50"
                              aria-label="좋아요"
                              onClick={() =>
                                void postFeedback(item.id, "like", loadAdjustments)
                              }
                            >
                              👍
                            </button>
                            <button
                              type="button"
                              className="btn border border-gray-200 bg-white px-3 py-1 rounded text-base hover:bg-gray-50"
                              aria-label="싫어요"
                              onClick={() =>
                                void postFeedback(
                                  item.id,
                                  "dislike",
                                  loadAdjustments
                                )
                              }
                            >
                              👎
                            </button>
                          </div>
                        </div>
                      </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">
                AI 추천 목록
              </p>
              {payload.data.length === 0 ? (
                <p className="text-sm text-gray-500">추천 항목이 없습니다.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {payload.data.map((item, i) => (
                    <li key={`${item.name}-${i}`} className="food-card">
                      <div className="border border-gray-100 rounded-lg p-3 bg-white space-y-2">
                        <div className="font-medium">{item.name}</div>
                        <div className="reason text-gray-700 text-sm whitespace-pre-wrap">
                          {item.reason?.trim()
                            ? item.reason
                            : "추천 이유가 없습니다."}
                        </div>
                        <div className="feedback flex gap-2 pt-1">
                          <button
                            type="button"
                            className="btn border border-gray-200 bg-white px-3 py-1 rounded text-base hover:bg-gray-50"
                            aria-label="좋아요"
                            onClick={() =>
                              void postFeedback(`ai-${i}`, "like", loadAdjustments)
                            }
                          >
                            👍
                          </button>
                          <button
                            type="button"
                            className="btn border border-gray-200 bg-white px-3 py-1 rounded text-base hover:bg-gray-50"
                            aria-label="싫어요"
                            onClick={() =>
                              void postFeedback(
                                `ai-${i}`,
                                "dislike",
                                loadAdjustments
                              )
                            }
                          >
                            👎
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
