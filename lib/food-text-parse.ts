export type ParsedFoodText = {
  name: string;
  protein: string;
  fat: string;
  ash: string;
  moisture: string;
  ingredients: string[];
  feature: string;
};

type MacroKey = "protein" | "fat" | "ash" | "moisture";

const emptyParsed: ParsedFoodText = {
  name: "",
  protein: "",
  fat: "",
  ash: "",
  moisture: "",
  ingredients: [],
  feature: "",
};

function normalizeOcrText(text: string): string {
  // 전각 -> 반각 + 공백/특수문자 정리 (OCR 깨짐 완화)
  const halfWidth = text.replace(/[\uFF01-\uFF5E]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );

  return halfWidth
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/％/g, "%")
    .replace(/Ｌ/g, "L")
    .replace(/－/g, "-")
    .replace(/[•·ㆍ]/g, ",")
    .replace(/[|]/g, ",")
    .replace(/\t+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeNumberText(raw: string): string {
  const v = raw.replace(/,/g, "").trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return "";
  return v;
}

function extractFirstGroup(text: string, regexes: RegExp[]): string {
  for (const r of regexes) {
    const m = r.exec(text);
    if (m && typeof m[1] === "string") {
      const cleaned = sanitizeNumberText(m[1]);
      if (cleaned !== "") return cleaned;
    }
  }
  return "";
}

function extractMacroPercent(text: string, key: MacroKey): string {
  const patterns: Record<MacroKey, RegExp[]> = {
    protein: [
      /조\s*단\s*백\s*질\s*([0-9]+(?:\.[0-9]+)?)\s*%?/i,
      /조\s*단\s*백\s*([0-9]+(?:\.[0-9]+)?)\s*%?/i,
      /단\s*백\s*질\s*([0-9]+(?:\.[0-9]+)?)\s*%?/i,
      /단\s*백\s*([0-9]+(?:\.[0-9]+)?)\s*%?/i,
    ],
    fat: [
      /조\s*지\s*방\s*([0-9]+(?:\.[0-9]+)?)\s*%?/i,
      /조\s*지\s*방\s*질\s*([0-9]+(?:\.[0-9]+)?)\s*%?/i,
      /지\s*방\s*([0-9]+(?:\.[0-9]+)?)\s*%?/i,
    ],
    ash: [
      /조\s*회\s*분\s*([0-9]+(?:\.[0-9]+)?)\s*%?/i,
      /조\s*열\s*분\s*([0-9]+(?:\.[0-9]+)?)\s*%?/i,
      /조\s*인\s*회\s*분\s*([0-9]+(?:\.[0-9]+)?)\s*%?/i,
      /조\s*조\s*분\s*([0-9]+(?:\.[0-9]+)?)\s*%?/i,
      /조회\s*분\s*([0-9]+(?:\.[0-9]+)?)\s*%?/i,
      /회\s*분\s*([0-9]+(?:\.[0-9]+)?)\s*%?/i,
    ],
    moisture: [
      /수\s*분\s*([0-9]+(?:\.[0-9]+)?)\s*%?/i,
      /함\s*수\s*율\s*([0-9]+(?:\.[0-9]+)?)\s*%?/i,
      /수\s*분\s*율\s*([0-9]+(?:\.[0-9]+)?)\s*%?/i,
      /moisture\s*([0-9]+(?:\.[0-9]+)?)\s*%?/i,
    ],
  };

  return extractFirstGroup(text, patterns[key]);
}

function extractName(text: string): string {
  const normalized = normalizeOcrText(text);
  if (normalized === "") return "";

  // Prefer explicit label (제품명/상품명) when present
  const labeled = /(?:제품\s*명|상품\s*명)\s*[:：]?\s*([^\n]+)/i.exec(normalized);
  if (labeled && typeof labeled[1] === "string") {
    return labeled[1].replace(/\s+/g, " ").trim();
  }

  // 전체 텍스트를 순회해 제품명 후보를 찾습니다.
  const lines = normalized.split(/\n+/);
  for (const line of lines) {
    const candidate = line.replace(/\s+/g, " ").trim();
    if (candidate === "") continue;
    if (
      /원재료|원료|성분|조단백|조지방|조회분|수분|등록성분|보증성분|급여량|주의|보관/i.test(
        candidate
      )
    ) {
      continue;
    }
    // 보통 제품명은 글자 비율이 높고 특수문자/숫자 비율이 낮습니다.
    if (candidate.length >= 3) {
      return candidate;
    }
  }

  return "";
}

function cleanIngredientBlock(raw: string): string {
  return raw
    .replace(/^[\s:：\-•*·]+/, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findFirstMatchPos(text: string, keywords: string[]): number {
  let pos = -1;
  for (const kw of keywords) {
    const r = new RegExp(escapeRegex(kw), "i");
    const m = r.exec(text);
    if (m && typeof m.index === "number") {
      if (pos < 0 || m.index < pos) pos = m.index;
    }
  }
  return pos;
}

function extractSection(
  text: string,
  startKeywords: string[],
  endKeywords: string[],
  maxWindow = 900
): string {
  const start = findFirstMatchPos(text, startKeywords);
  if (start < 0) return "";

  const afterStart = text.slice(start);
  const windowMatch = new RegExp("([\\s\\S]{1," + String(maxWindow) + "})").exec(afterStart);
  if (!windowMatch || typeof windowMatch[1] !== "string") return "";
  const windowText = windowMatch[1];

  let endPos = -1;
  for (const endKw of endKeywords) {
    const r = new RegExp(escapeRegex(endKw), "i");
    const m = r.exec(windowText);
    if (m && typeof m.index === "number") {
      if (m.index > 0 && (endPos < 0 || m.index < endPos)) endPos = m.index;
    }
  }

  if (endPos >= 0) {
    const section = new RegExp("([\\s\\S]{1," + String(endPos) + "})").exec(windowText);
    if (section && typeof section[1] === "string") return cleanIngredientBlock(section[1]);
  }
  return cleanIngredientBlock(windowText);
}

function normalizeIngredientToken(token: string): string {
  return token
    .replace(/^(원재료명|원재료|원료|성분|ingredients?)\s*[:：]?\s*/i, "")
    .replace(/^[\s,;:：\-*※]+/, "")
    .replace(/[()\[\]{}]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function ingredientTokenValid(token: string): boolean {
  if (token.length < 2) return false;
  if (/^[0-9.%gmgkcal\/\s-]+$/i.test(token)) return false;
  if (/^(원재료|원료|성분|사용한 원료의 명칭|ingredients)$/i.test(token)) return false;
  if (/(정보|안내|주의|보관|급여|등록성분|보증성분)/i.test(token)) return false;
  return /[a-zA-Z가-힣]/.test(token);
}

function toIngredientList(rawBlock: string): string[] {
  const normalized = rawBlock
    .replace(/\n/g, ",")
    .replace(/[;；]/g, ",")
    .replace(/[，、]/g, ",");

  const chunks = normalized.split(",");
  const out: string[] = [];
  for (const c of chunks) {
    const t = normalizeIngredientToken(c);
    if (!ingredientTokenValid(t)) continue;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

function extractIngredients(text: string): { block: string; list: string[] } {
  const normalized = normalizeOcrText(text);
  if (normalized === "") return { block: "", list: [] };

  const starts = [
    "사용한 원료의 명칭", // 1순위
    "원재료명",
    "원재료",
    "Ingredients",
    "INGREDIENTS",
  ];
  const ends = [
    "등록성분량",
    "등록성분",
    "보증성분",
    "조단백",
    "조지방",
    "조회분",
    "수분",
    "급여방법",
    "주의사항",
    "보관방법",
    "※",
    "*",
  ];

  const block = extractSection(normalized, starts, ends, 1200);
  if (block !== "") {
    const list = toIngredientList(block);
    if (list.length > 0) return { block, list };
  }

  // fallback: 전체 텍스트 쉼표 분해 후 식재료 후보를 추립니다.
  const fallbackCandidates = normalized
    .replace(/\n/g, ",")
    .replace(/[;；]/g, ",")
    .split(",");
  const fallbackList: string[] = [];
  for (const c of fallbackCandidates) {
    const t = normalizeIngredientToken(c);
    if (!ingredientTokenValid(t)) continue;
    if (!fallbackList.includes(t)) fallbackList.push(t);
    if (fallbackList.length >= 40) break;
  }
  if (fallbackList.length >= 3) {
    const fallbackBlock = fallbackList.join(", ");
    return { block: fallbackBlock, list: fallbackList };
  }
  return { block: "", list: [] };
}

function buildFeature(text: string, ingredientBlock: string): string {
  let base = normalizeOcrText(text);
  if (ingredientBlock !== "") {
    const escaped = escapeRegex(ingredientBlock);
    base = base.replace(new RegExp(escaped, "i"), " ");
  }
  base = base
    .replace(/조\s*단\s*백\s*질?\s*[:：]?\s*[0-9]+(?:\.[0-9]+)?\s*%?/gi, " ")
    .replace(/조\s*지\s*방\s*[:：]?\s*[0-9]+(?:\.[0-9]+)?\s*%?/gi, " ")
    .replace(/조\s*회\s*분\s*[:：]?\s*[0-9]+(?:\.[0-9]+)?\s*%?/gi, " ")
    .replace(/수\s*분\s*[:：]?\s*[0-9]+(?:\.[0-9]+)?\s*%?/gi, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const short = /([\s\S]{1,400})/.exec(base);
  if (short && typeof short[1] === "string") {
    return short[1].trim();
  }
  return base;
}

/**
 * OCR raw text 파서 (재사용 가능)
 * - 텍스트를 자르기보다 구간(시작/종료 키워드) 단위로 처리
 * - 원재료는 배열로 반환
 */
export function parseFoodText(text: string): ParsedFoodText {
  const raw = typeof text === "string" ? text : "";
  console.log("RAW TEXT:", raw);

  const normalized = normalizeOcrText(raw);
  console.log("NORMALIZED:", normalized);
  if (normalized === "") return { ...emptyParsed };

  const protein = extractMacroPercent(normalized, "protein");
  const fat = extractMacroPercent(normalized, "fat");
  const ash = extractMacroPercent(normalized, "ash");
  const moisture = extractMacroPercent(normalized, "moisture");
  const name = extractName(normalized);

  const ingredientResult = extractIngredients(normalized);
  console.log("INGREDIENT BLOCK:", ingredientResult.block);
  console.log("INGREDIENT LIST:", ingredientResult.list);

  const feature = buildFeature(normalized, ingredientResult.block);

  const result: ParsedFoodText = {
    name,
    protein,
    fat,
    ash,
    moisture,
    ingredients: ingredientResult.list,
    feature,
  };

  // 안전하게 문자열/배열 타입 보정
  if (!Array.isArray(result.ingredients)) {
    result.ingredients = [];
  } else {
    const fixed: string[] = [];
    for (const v of result.ingredients) {
      if (typeof v === "string" && v.trim() !== "") {
        fixed.push(v.trim());
      }
    }
    result.ingredients = fixed;
  }

  if (typeof result.feature !== "string") result.feature = "";
  if (typeof result.name !== "string") result.name = "";
  if (typeof result.protein !== "string") result.protein = "";
  if (typeof result.fat !== "string") result.fat = "";
  if (typeof result.ash !== "string") result.ash = "";
  if (typeof result.moisture !== "string") result.moisture = "";

  return result;
}

