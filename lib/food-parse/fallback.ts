import type { FoodParsedSnapshot } from "@/lib/food-record";

/**
 * AI 실패·검증 실패 시: 원문 보존 + UI 수정 유도
 */
export function buildFallbackParsed(rawText: string): FoodParsedSnapshot {
  const trimmed = rawText.trim();
  return {
    name: "",
    brand: null,
    protein: null,
    fat: null,
    fiber: null,
    kcal: null,
    ingredients: trimmed.length > 0 ? [trimmed] : ["(원문 없음)"],
    tags: [],
    feature:
      "AI 정제에 실패했거나 결과가 불완전합니다. 아래 원문을 참고해 수동으로 수정해 주세요.",
    target: ["수동검수"],
  };
}
