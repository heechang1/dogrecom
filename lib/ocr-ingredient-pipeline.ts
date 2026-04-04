/**
 * Google Vision fullTextAnnotation.text → 원재료 연속 블록 + 토큰 배열.
 * 원재료는 여러 줄에 걸친 하나의 블록으로 취급 (줄 단위 선택 없음).
 */

export type ProcessOCRResult = {
  rawText: string;
  ingredientBlock: string;
  ingredients: string[];
};

const KEYWORD_RE = /사용한\s*원료의\s*명칭\s*[:：]?/i;
/** OCR이 글자 사이를 끊는 경우 보조 (여전히 단일 연속 문자열에서만 매칭) */
const KEYWORD_RE_LOOSE =
  /사\s*용\s*한\s*원\s*료\s*의\s*명\s*칭\s*[:：]?/i;

/** 키워드 직후 원재료 셀 전체(표 여러 줄)까지 허용; 실제 끝은 STOP_MARKERS에서 자름 */
const BLOCK_AFTER_KEYWORD_MAX = 5000;
const WONRYO_MIN = 200;
/** "원료" 폴백 시에도 다음 섹션 전까지 넉넉히 */
const WONRYO_WINDOW_MAX = 5000;

/**
 * 라벨 예: "등록 성분량"(띄어쓰기), "등록성분", "보증성분" 등 다음 섹션 시작
 */
const STOP_MARKERS = [
  "※",
  "등록 성분량",
  "등록성분량",
  "등록성분",
  "보증성분",
  "보증 성분",
  "조단백",
  "조 지방",
  "조지방",
];

const NOISE_SUBSTRINGS = [
  "사료",
  "종류",
  "등록",
  "성분",
  "이상",
  "이하",
  "%",
  "kg",
  "제조",
  "유통",
  "HEM",
];

/**
 * 한글 원재료명이 1글자인 경우(예: 쌀) — 2글자 미만 규칙에서 예외
 */
const SINGLE_CHAR_INGREDIENTS = new Set<string>(["쌀"]);

/**
 * 모든 줄을 하나의 연속 문자열로 합침 (줄 기반 추출 금지).
 */
export function normalize(text: string): string {
  if (typeof text !== "string") {
    return "";
  }

  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n/g, " ")
    .replace(/\|/g, "")
    .replace(/\s+/g, " ")
    .replace(/[,]{2,}/g, ",")
    .replace(/,\s*,/g, ",")
    .trim();
}

function cutAtStops(segment: string): string {
  let out = segment;
  let best = -1;

  for (let i = 0; i < STOP_MARKERS.length; i += 1) {
    const marker = STOP_MARKERS[i];
    const idx = out.indexOf(marker);
    if (idx >= 0 && (best < 0 || idx < best)) {
      best = idx;
    }
  }

  if (best >= 0) {
    out = out.slice(0, best);
  }

  return out.trim();
}

function matchKeywordEnd(normalized: string): number {
  let m = KEYWORD_RE.exec(normalized);
  if (m && m[0] !== undefined && typeof m.index === "number") {
    return m.index + m[0].length;
  }
  m = KEYWORD_RE_LOOSE.exec(normalized);
  if (m && m[0] !== undefined && typeof m.index === "number") {
    return m.index + m[0].length;
  }
  return -1;
}

/**
 * 키워드 직후부터 다음 섹션(등록 성분량 등) 전까지 — 300자 고정 금지(표형 누락 방지).
 */
function extractAfterKeyword(normalized: string): string {
  const end = matchKeywordEnd(normalized);
  if (end < 0) {
    return "";
  }

  const after = normalized.slice(end).replace(/^\s+/, "");
  const take = Math.min(after.length, BLOCK_AFTER_KEYWORD_MAX);
  let windowed = after.slice(0, take);
  const star = windowed.indexOf("※");
  if (star >= 0) {
    windowed = windowed.slice(0, star);
  }
  return cutAtStops(windowed);
}

/**
 * "원료" 첫 등장 이후 (키워드 실패 시, 다음 섹션 전까지 최대 WONRYO_WINDOW_MAX).
 */
function extractAfterWonryo(normalized: string): string {
  const idx = normalized.indexOf("원료");
  if (idx < 0) {
    return "";
  }

  const start = idx + "원료".length;
  const endPos = Math.min(normalized.length, start + WONRYO_WINDOW_MAX);
  let chunk = normalized.slice(start, endPos).trim();
  chunk = chunk.replace(/^\s*의\s*명칭\s*[:：]?\s*/i, "");

  if (chunk.length < WONRYO_MIN && normalized.length > start) {
    const moreEnd = Math.min(normalized.length, start + WONRYO_WINDOW_MAX);
    chunk = normalized.slice(start, moreEnd).trim();
  }

  const star = chunk.indexOf("※");
  if (star >= 0) {
    chunk = chunk.slice(0, star);
  }

  return cutAtStops(chunk.trim());
}

/**
 * 연속 블록만 반환 (라인 분리·줄 단위 선택 없음).
 */
export function extractIngredientBlock(text: string): string {
  const normalized = normalize(text);
  if (normalized === "") {
    return "";
  }

  let block = extractAfterKeyword(normalized);
  if (block === "") {
    block = extractAfterWonryo(normalized);
  }

  return block.trim();
}

export function isValidIngredient(token: string): boolean {
  if (typeof token !== "string") {
    return false;
  }
  const t = token.trim();
  if (t === "") {
    return false;
  }
  if (t.length < 2 && !SINGLE_CHAR_INGREDIENTS.has(t)) {
    return false;
  }

  for (let i = 0; i < NOISE_SUBSTRINGS.length; i += 1) {
    const n = NOISE_SUBSTRINGS[i];
    if (n !== "" && t.indexOf(n) >= 0) {
      return false;
    }
  }

  if (/^[0-9.,\s%/-]+$/.test(t)) {
    return false;
  }

  if (!/[a-zA-Z가-힣]/.test(t)) {
    return false;
  }

  return true;
}

/**
 * 괄호 안 쉼표는 분리하지 않음 — 예: 육분(닭, 오리), 쌀, 옥수수
 */
export function splitIngredientTokens(block: string): string[] {
  if (typeof block !== "string" || block.trim() === "") {
    return [];
  }

  const s = block.replace(/，|、/g, ",");
  const result: string[] = [];
  let depth = 0;
  let cur = "";

  for (let i = 0; i < s.length; i += 1) {
    const c = s.charAt(i);
    if (c === "(" || c === "（") {
      depth += 1;
      cur += c;
      continue;
    }
    if (c === ")" || c === "）") {
      depth = Math.max(0, depth - 1);
      cur += c;
      continue;
    }
    if (c === "," && depth === 0) {
      const trimmed = cur.trim();
      if (trimmed !== "") {
        result.push(trimmed);
      }
      cur = "";
      continue;
    }
    cur += c;
  }

  const last = cur.trim();
  if (last !== "") {
    result.push(last);
  }

  return result;
}

export function parseIngredients(block: string): string[] {
  if (typeof block !== "string" || block.trim() === "") {
    return [];
  }

  const parts = splitIngredientTokens(block);
  const out: string[] = [];

  for (let i = 0; i < parts.length; i += 1) {
    const trimmed = parts[i].trim();
    if (trimmed === "") {
      continue;
    }
    if (isValidIngredient(trimmed) && out.indexOf(trimmed) === -1) {
      out.push(trimmed);
    }
  }

  return out;
}

/** Vision 블록 파서용 (HEM 등 일부 노이즈 제외) */
const VISION_BLOCK_NOISE = [
  "사료",
  "종류",
  "등록",
  "성분",
  "이상",
  "이하",
  "%",
  "kg",
  "제조",
  "유통",
];

function isValidVisionBlockToken(token: string): boolean {
  const t = token.trim();
  if (t === "") {
    return false;
  }
  if (t.length < 2 && !SINGLE_CHAR_INGREDIENTS.has(t)) {
    return false;
  }
  for (let i = 0; i < VISION_BLOCK_NOISE.length; i += 1) {
    const n = VISION_BLOCK_NOISE[i];
    if (n !== "" && t.indexOf(n) >= 0) {
      return false;
    }
  }
  if (/^[0-9.,\s%/-]+$/.test(t)) {
    return false;
  }
  if (!/[a-zA-Z가-힣]/.test(t)) {
    return false;
  }
  return true;
}

/**
 * Vision 블록 병합 문자열 → 원재료 토큰 배열 (괄호 내 쉼표 유지)
 */
export function parseVisionBlockIngredients(block: string): string[] {
  if (typeof block !== "string" || block.trim() === "") {
    return [];
  }
  const parts = splitIngredientTokens(block);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const trimmed = parts[i].trim();
    if (trimmed === "") {
      continue;
    }
    if (isValidVisionBlockToken(trimmed) && out.indexOf(trimmed) === -1) {
      out.push(trimmed);
    }
  }
  return out;
}

export function processOCR(text: string): ProcessOCRResult {
  const rawText = typeof text === "string" ? text : "";

  console.log("OCR FULL:", rawText);

  const normalized = normalize(rawText);
  console.log("NORMALIZED:", normalized);

  const ingredientBlock = extractIngredientBlock(text);
  console.log("BLOCK:", ingredientBlock);

  const ingredients = parseIngredients(ingredientBlock);
  console.log("INGREDIENTS:", ingredients);

  return {
    rawText,
    ingredientBlock,
    ingredients,
  };
}
