export type FoodCategory = "diet" | "normal" | "hypoallergenic";

/** AI 정제 결과 스냅샷 (DB `parsed` 필드, 추천은 상위 필드와 동기화) */
export type FoodParsedSnapshot = {
  name: string;
  brand: string | null;
  protein: number | null;
  fat: number | null;
  fiber: number | null;
  kcal: number | null;
  ingredients: string[];
  tags: string[];
  feature: string;
  target: string[];
};

/** foods.json 한 행 (추천·OCR 저장 공통) */
export type FoodRecord = {
  id: number;
  name: string;
  brand?: string;
  category: FoodCategory;
  protein: number;
  fat: number;
  carb: number;
  fiber?: number;
  kcal?: number | null;
  ingredients: string[];
  purpose: "diet" | "normal";
  tags: string[];
  feature: string;
  target: string[];
  /** 원본 OCR (AI 파이프라인) */
  raw_ocr?: string;
  /** 정제된 구조 보관 */
  parsed?: FoodParsedSnapshot;
};

/** OCR·폼에서 넘어오는 초안 (id 없음) */
export type FoodDraft = {
  name: string;
  brand: string;
  protein: number | null;
  fat: number | null;
  fiber: number | null;
  kcal: number | null;
  ingredients: string[];
  tags: string[];
  feature: string;
  target: string[];
  category: FoodCategory;
};

export function defaultPurposeFromCategory(c: FoodCategory): "diet" | "normal" {
  return c === "diet" ? "diet" : "normal";
}

export function estimateCarb(
  protein: number,
  fat: number,
  fiber: number | null
): number {
  const f = fiber ?? 3;
  const c = 100 - protein - fat - f * 0.5;
  return Math.round(Math.min(55, Math.max(28, c)));
}
