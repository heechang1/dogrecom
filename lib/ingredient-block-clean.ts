/**
 * Vision 블록 병합 직후 문자열 정제 (추출 로직과 분리).
 */

import { parseVisionBlockIngredients } from "@/lib/ocr-ingredient-pipeline";

export type ProcessIngredientBlockResult = {
  cleanedBlock: string;
  ingredients: string[];
};

const TAIL_MARKERS = [
  "등록성분",
  "등록 성분",
  "등록 성분량",
  "등록성분량",
  "조단백",
  "※",
];

/**
 * 선두 라벨 제거: 사용한 원료의 명칭 / 원료 의 명칭 / 원료의명칭 등
 */
export function cleanStart(text: string): string {
  if (typeof text !== "string") {
    return "";
  }
  let t = text.trim();
  t = t.replace(
    /^\s*(?:.*?\s+)?(?:사용한\s+)?원료\s*의?\s*명칭\s*[:：]?\s*/i,
    ""
  );
  t = t.replace(/^\s*원료의명칭\s*[:：]?\s*/i, "");
  t = t.replace(/^\s*원료\s+의\s+명칭\s*[:：]?\s*/i, "");
  return t.trim();
}

/**
 * 흔한 OCR 오타·붙은 글자 완화
 */
export function cleanNoise(text: string): string {
  if (typeof text !== "string") {
    return "";
  }
  let t = text;
  t = t.replace(/함제/g, "첨가제");
  t = t.replace(/의명칭/g, "의 명칭");
  t = t.replace(/\s+/g, " ");
  t = t.replace(/,{2,}/g, ",");
  t = t.replace(/,\s*,/g, ",");
  return t.trim();
}

/**
 * 쉼표 주변 공백 정리: "a ,  b,, c" → "a, b, c"
 */
export function normalizeFormatting(text: string): string {
  if (typeof text !== "string") {
    return "";
  }
  let t = text.replace(/\s+/g, " ").trim();
  t = t.replace(/\s+,/g, ",");
  t = t.replace(/,\s*/g, ", ");
  t = t.replace(/,\s*,+/g, ", ");
  t = t.replace(/,{2,}/g, ",");
  t = t.replace(/,\s+/g, ", ");
  return t.trim();
}

/**
 * 다음 섹션(성분표 등) 앞에서 절단
 */
export function trimTail(text: string): string {
  if (typeof text !== "string" || text === "") {
    return "";
  }
  let t = text;
  let best = -1;
  for (let i = 0; i < TAIL_MARKERS.length; i += 1) {
    const m = TAIL_MARKERS[i];
    const idx = t.indexOf(m);
    if (idx >= 0 && (best < 0 || idx < best)) {
      best = idx;
    }
  }
  if (best >= 0) {
    t = t.slice(0, best);
  }
  return t.trim();
}

/**
 * 정제 파이프라인 + 토큰 파싱
 */
export function processIngredientBlock(
  text: string
): ProcessIngredientBlockResult {
  const raw = typeof text === "string" ? text : "";
  console.log("RAW BLOCK:", raw);

  let result = raw;
  result = cleanStart(result);
  result = cleanNoise(result);
  result = normalizeFormatting(result);
  result = trimTail(result);
  result = normalizeFormatting(result);
  result = result.trim();

  console.log("CLEANED BLOCK:", result);

  const ingredients = parseVisionBlockIngredients(result);
  console.log("INGREDIENTS:", ingredients);

  return {
    cleanedBlock: result,
    ingredients,
  };
}
