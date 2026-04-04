import type { FoodCategory, FoodDraft } from "@/lib/food-record";
import { applyRuleTags } from "@/lib/food-auto-tags";
import { parseIngredientsSync } from "@/lib/ingredients-parse";

/** OCR 토큰에서 첫 숫자(선택 소수점)만 parseFloat로 추출 — parseInt 사용 안 함 */
export function extractNumber(text: string): number | null {
  const match = text.match(/([\d]+\.?[\d]*)/);
  if (!match?.[1]) return null;
  const n = parseFloat(match[1]);
  return Number.isFinite(n) ? n : null;
}

/** 조단백 등 % 성분: 0~100만 유효 */
export function validatePercent(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (value < 0 || value > 100) return null;
  return value;
}

/** ME(kcal/kg) 등 일반적인 사료 칼로리 범위 */
export function validateKcal(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (value < 200 || value > 8000) return null;
  return value;
}

/**
 * 소수점이 빠진 OCR(예: 12.96 → "1296") 보정: /100, /10 후 validatePercent 통과 시 채택
 */
function recoverPercentFromOcrToken(raw: string, field: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  const first = extractNumber(cleaned);
  if (first === null) {
    console.log("raw:", raw, "parsed:", null, field);
    return null;
  }

  let candidate = first;
  if (validatePercent(candidate) === null) {
    if (first > 100 && first <= 9999 && Number.isInteger(first)) {
      const by100 = first / 100;
      if (validatePercent(by100) !== null) {
        candidate = by100;
        console.log(
          "ocr-parse recoverPercent /100:",
          first,
          "->",
          candidate,
          field
        );
      } else {
        const by10 = first / 10;
        if (validatePercent(by10) !== null) {
          candidate = by10;
          console.log(
            "ocr-parse recoverPercent /10:",
            first,
            "->",
            candidate,
            field
          );
        }
      }
    }
  }

  const out = validatePercent(candidate);
  console.log("raw:", raw, "parsed:", out, field);
  return out;
}

function parseKcalFromOcrText(text: string): number | null {
  const m =
    text.match(/(?:kcal|Kcal|KCAL|칼로리|대사에너지)\s*[：:]?\s*([\d.,\s]+)\s*k?cal?/i) ??
    text.match(/([\d.,]{3,7})\s*kcal/i);

  const raw = m?.[1]?.replace(/,/g, "").replace(/\s/g, "").trim() ?? "";
  if (!raw) {
    console.log("raw:", "(no kcal match)", "parsed:", null, "kcal");
    return null;
  }

  let value = extractNumber(raw);
  if (value === null) {
    console.log("raw:", raw, "parsed:", null, "kcal");
    return null;
  }

  if (value < 200) {
    value = value * 100;
    console.log("ocr-parse kcal scale *100:", raw, "->", value);
  }

  if (value > 8000 && value <= 999999 && Number.isInteger(value)) {
    const try10 = value / 10;
    if (validateKcal(try10) !== null) {
      value = try10;
      console.log("ocr-parse kcal recover /10:", value);
    }
  }

  const out = validateKcal(value);
  console.log("raw:", raw, "parsed:", out, "kcal");
  return out;
}

/** 조단백·단백질·조지방·조섬유·kcal 등 라벨에서 수치 추출 */
export function parseNutritionFromOcrText(raw: string): {
  protein: number | null;
  fat: number | null;
  fiber: number | null;
  kcal: number | null;
} {
  const text = raw.replace(/\s+/g, " ");

  const pickPercent = (
    primary: RegExpMatchArray | null,
    fallback: RegExpMatchArray | null,
    field: string
  ): number | null => {
    const cap = primary?.[1] ?? fallback?.[1];
    if (cap == null || String(cap).trim() === "") return null;
    return recoverPercentFromOcrToken(String(cap), field);
  };

  const protein = pickPercent(
    text.match(/(?:조\s*단백|조단백|단백질)\s*[：:]?\s*([^\n%]{0,24}?)\s*%?/i),
    text.match(/단백\s*[：:]?\s*([^\n%]{0,24}?)\s*%/i),
    "protein"
  );

  const fat = pickPercent(
    text.match(/(?:조\s*지방|조지방)\s*[：:]?\s*([^\n%]{0,24}?)\s*%?/i),
    text.match(/지방\s*[：:]?\s*([^\n%]{0,24}?)\s*%/i),
    "fat"
  );

  const fiber = pickPercent(
    text.match(/(?:조\s*섬유|조섬유|조섬유질)\s*[：:]?\s*([^\n%]{0,24}?)\s*%?/i),
    text.match(/섬유\s*[：:]?\s*([^\n%]{0,24}?)\s*%/i),
    "fiber"
  );

  const kcal = parseKcalFromOcrText(text);

  return { protein, fat, fiber, kcal };
}

/** 원재료·사용한 원료 구간만 잘라 내기 (깨진 OCR 문자열) */
export function extractIngredientBlockFromOcr(raw: string): string {
  const lines = raw.split(/\r?\n/);
  let block = "";
  let capture = false;
  for (const line of lines) {
    if (
      /원재료|사용한\s*원료|원료\s*및|배합비율|성분/i.test(line)
    ) {
      capture = true;
      const after = line.replace(
        /^.*?(?:원재료|사용한\s*원료|원료\s*및)[：:\s]*/i,
        ""
      );
      if (after.length > 2) {
        block += after + " ";
      }
      continue;
    }
    if (capture) {
      if (/영양|조단백|조지방|보관|유통|제조/i.test(line) && line.length < 40) {
        break;
      }
      block += line + " ";
    }
  }

  if (!block.trim()) {
    const m = raw.match(
      /(?:원재료|사용한\s*원료)\s*[：:]\s*([\s\S]+?)(?=\n\n|조단백|조지방|영양성분|$)/i
    );
    if (m?.[1]) block = m[1];
  }

  return block.trim();
}

/** @deprecated 블록 추출 후 {@link parseIngredientsSync} 사용 권장 */
export function parseIngredientsFromOcrText(raw: string): string[] {
  const block = extractIngredientBlockFromOcr(raw);
  return parseIngredientsSync(block).ingredients;
}

function guessNameFromOcr(raw: string): string {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && l.length < 80);
  for (const line of lines) {
    if (/영양성분|조단백|원재료|kcal|사료|급여/i.test(line)) continue;
    if (/^[A-Za-z0-9\s\-&.]+$/.test(line) && line.length < 15) continue;
    return line;
  }
  return "";
}

function guessBrandFromOcr(raw: string): string {
  const m = raw.match(/(?:브랜드|제조|판매원)\s*[：:]\s*([^\n]+)/);
  return m?.[1]?.trim() ?? "";
}

function guessCategory(
  text: string,
  protein: number | null,
  fat: number | null
): FoodCategory {
  const T = text;
  if (
    T.includes("저알러지") ||
    T.includes("하이포") ||
    T.includes("단일단백") ||
    T.includes("가수분해")
  ) {
    return "hypoallergenic";
  }
  if (
    T.includes("다이어트") ||
    T.includes("저지방") ||
    T.includes("라이트") ||
    T.includes("체중") ||
    (fat !== null && fat <= 10 && protein !== null)
  ) {
    return "diet";
  }
  return "normal";
}

/** OCR 전체 텍스트 → 초안 JSON + 룰 태그 병합 */
export function parseOcrTextToDraft(ocrText: string): FoodDraft {
  const nut = parseNutritionFromOcrText(ocrText);
  const block = extractIngredientBlockFromOcr(ocrText);
  const { ingredients } = parseIngredientsSync(
    block.length > 0 ? block : ocrText
  );
  const name = guessNameFromOcr(ocrText);
  const brand = guessBrandFromOcr(ocrText);
  const category = guessCategory(ocrText, nut.protein, nut.fat);

  const baseTags: string[] = [];
  if (category === "diet") baseTags.push("다이어트");

  const tags = applyRuleTags(ocrText, baseTags);

  const feature =
    ocrText.replace(/\s+/g, " ").trim() || "";

  return {
    name,
    brand,
    protein: nut.protein,
    fat: nut.fat,
    fiber: nut.fiber,
    kcal: nut.kcal,
    ingredients: ingredients.length > 0 ? ingredients : [],
    tags,
    feature,
    target: [],
    category,
  };
}
