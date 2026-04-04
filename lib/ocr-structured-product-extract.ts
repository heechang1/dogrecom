/**
 * Google Vision 블록 병합 OCR 텍스트에서 제품명·브랜드·등록 성분량 수치 추출.
 * AI/추측 없이 정규식만 사용.
 */

export type StructuredOcrProduct = {
  name: string;
  brand: string;
  weight: number | null;
  protein: number | null;
  fat: number | null;
  fiber: number | null;
  ash: number | null;
  moisture: number | null;
  category: string;
  /** OpenAI 요약은 파이프라인에서 채움; 동기 추출만 쓰면 빈 문자열 */
  summary: string;
};

/** 제품명 이후에서 자를 키워드 (앞쪽이 최소 인덱스로 선택) */
const PRODUCT_NAME_STOP_PHRASES: string[] = [
  "실중량",
  "성분등록번호",
  "사료의 명칭",
  "사료의 형태",
  "사료의 종류",
  "사용한 원료",
  "원료의 명칭",
  "등록 성분",
  "제조 및",
  "반려견",
  "견종",
];

export function cleanOcrNoise(text: string): string {
  if (typeof text !== "string") {
    return "";
  }
  let s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  s = s.replace(/[\uFF01-\uFF5E]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
  s = s.replace(/％/g, "%");
  s = s.replace(/[，、]/g, ",");
  s = s.replace(/[|｜]/g, " ");
  s = s.replace(/[^\S\n]+/g, " ");
  s = s.replace(/[·•‧・]/g, " ");
  s = s.replace(/\s*,\s*/g, ", ");
  s = s.replace(/,{2,}/g, ",");
  s = s.replace(/\t/g, " ");
  s = s.replace(/[ \u00A0]+/g, " ");
  s = s.replace(/\n+/g, "\n");
  return s.trim();
}

/**
 * 원재료 블록만으로 규칙 기반 분류 (OCR 추측 없음).
 */
export function classifyCategoryFromIngredientBlock(
  ingredientBlock: string
): string {
  const block = typeof ingredientBlock === "string" ? ingredientBlock : "";
  if (/저지방|다이어트/.test(block)) {
    return "다이어트";
  }
  if (/알러지|알레르기/.test(block)) {
    return "알러지";
  }
  return "일반";
}

/**
 * 블록 OCR + 원재료 블록을 한 줄로 합쳐 줄바꿈 깨짐 대응
 */
export function mergeOcrInput(
  rawOcrFromBlocks: string,
  ingredientBlock: string
): string {
  const a = typeof rawOcrFromBlocks === "string" ? rawOcrFromBlocks : "";
  const b = typeof ingredientBlock === "string" ? ingredientBlock : "";
  return cleanOcrNoise(a + " " + b);
}

function sliceBeforeEarliestPhrase(haystack: string, phrases: string[]): number {
  let best = haystack.length;
  for (let i = 0; i < phrases.length; i += 1) {
    const p = phrases[i];
    if (p === "") {
      continue;
    }
    const idx = haystack.indexOf(p);
    if (idx >= 0 && idx < best) {
      best = idx;
    }
  }
  return best;
}

export function extractProductName(text: string): string {
  const t = cleanOcrNoise(text);
  if (t === "") {
    return "";
  }
  const label = /제품\s*명\s*[:：]?\s*/i;
  const m = label.exec(t);
  if (!m || m.index === undefined) {
    return "";
  }
  const start = m.index + m[0].length;
  const rest = t.slice(start);
  const oneLine = rest.replace(/\s+/g, " ");
  const end = sliceBeforeEarliestPhrase(oneLine, PRODUCT_NAME_STOP_PHRASES);
  return oneLine.slice(0, end).replace(/\s+/g, " ").trim();
}

/** 실중량 N kg → N (kg만; OCR에 없으면 null) */
export function extractWeightKg(text: string): number | null {
  const t = cleanOcrNoise(text);
  if (t === "") {
    return null;
  }
  const m = /실중량\s*[:：]?\s*([0-9]+(?:\.[0-9]+)?)\s*kg/i.exec(t);
  if (!m || typeof m[1] !== "string") {
    return null;
  }
  const n = parseFloat(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function trimBrandFragment(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  const stopWords = [
    "/",
    "충청",
    "경기",
    "서울",
    "부산",
    "대전",
    "광주",
    "울산",
    "강원",
    "전라",
    "경상",
    "제주",
    "주소",
    "소재지",
    "TEL",
    "Tel",
    "tel",
    "FAX",
    "고객",
  ];
  let best = s.length;
  for (let i = 0; i < stopWords.length; i += 1) {
    const idx = s.indexOf(stopWords[i]);
    if (idx > 0 && idx < best) {
      best = idx;
    }
  }
  if (best < s.length) {
    s = s.slice(0, best).trim();
  }
  s = s.replace(/[,，]\s*$/, "").trim();
  return s;
}

export function extractBrand(text: string): string {
  const t = cleanOcrNoise(text);
  if (t === "") {
    return "";
  }

  const patterns = [
    /제조\s*및\s*판매원\s*[:：]?\s*(.+?)(?=\s+(?:제조원|판매원|주소|소재지|고객)|$)/i,
    /제조원\s*[:：]?\s*(.+?)(?=\s+(?:판매원|주소|소재지)|$)/i,
    /판매원\s*[:：]?\s*(.+?)(?=\s+(?:제조원|주소|소재지)|$)/i,
  ];

  for (let p = 0; p < patterns.length; p += 1) {
    const m = patterns[p].exec(t);
    if (m && typeof m[1] === "string") {
      return trimBrandFragment(m[1]);
    }
  }

  const m2 = /제조\s*및\s*판매원\s*[:：]?\s*([^\n/]+)/i.exec(t);
  if (m2 && typeof m2[1] === "string") {
    return trimBrandFragment(m2[1]);
  }
  const m3 = /제조원\s*[:：]?\s*([^\n/]+)/i.exec(t);
  if (m3 && typeof m3[1] === "string") {
    return trimBrandFragment(m3[1]);
  }
  const m4 = /판매원\s*[:：]?\s*([^\n/]+)/i.exec(t);
  if (m4 && typeof m4[1] === "string") {
    return trimBrandFragment(m4[1]);
  }

  return "";
}

function parseNutrientNumber(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") {
    return null;
  }
  const n = parseFloat(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * 조단백/조지방 등 라벨과 숫자 사이에 줄바꿈·문자 허용 ([\s\S] 최소 매칭)
 */
export function extractNutrientPercent(
  text: string,
  labelPattern: RegExp
): number | null {
  const t = cleanOcrNoise(text);
  if (t === "") {
    return null;
  }
  const combined = new RegExp(
    "(" + labelPattern.source + ")([\\s\\S]{0,80}?)([0-9]+(?:\\.[0-9]+)?)\\s*%",
    "i"
  );
  const m = combined.exec(t);
  if (m && typeof m[3] === "string") {
    return parseNutrientNumber(m[3]);
  }
  const loose = new RegExp(
    labelPattern.source + "\\s*[:：]?\\s*([0-9]+(?:\\.[0-9]+)?)\\s*%?",
    "i"
  );
  const m2 = loose.exec(t);
  if (m2 && typeof m2[1] === "string") {
    return parseNutrientNumber(m2[1]);
  }
  return null;
}

export function extractStructuredProductFromOcr(
  rawOcrFromBlocks: string,
  ingredientBlock: string
): StructuredOcrProduct {
  const merged = mergeOcrInput(rawOcrFromBlocks, ingredientBlock);

  const name = extractProductName(merged);
  const brand = extractBrand(merged);
  const weight = extractWeightKg(merged);

  const protein = extractNutrientPercent(merged, /조\s*단\s*백(?:\s*질)?/);
  const fat = extractNutrientPercent(merged, /조\s*지\s*방/);
  const fiber = extractNutrientPercent(merged, /조\s*섬\s*유/);
  const ash = extractNutrientPercent(merged, /조\s*회\s*분/);
  const moisture = extractNutrientPercent(merged, /수\s*분/);

  const category = classifyCategoryFromIngredientBlock(ingredientBlock);

  console.log("NAME:", name);
  console.log("BRAND:", brand);
  console.log("WEIGHT:", weight);
  console.log("PROTEIN:", protein);
  console.log("FAT:", fat);
  console.log("FIBER:", fiber);
  console.log("ASH:", ash);
  console.log("MOISTURE:", moisture);
  console.log("CATEGORY:", category);

  return {
    name,
    brand,
    weight,
    protein,
    fat,
    fiber,
    ash,
    moisture,
    category,
    summary: "",
  };
}
