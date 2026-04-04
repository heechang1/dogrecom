/** 파싱 결과 (향후 GPT 보정 단계에서 동일 형태 유지) */
export type IngredientsParseResult = {
  ingredients: string[];
  /** normalizeText 적용 후 문자열 */
  normalizedText: string;
  /** 사전 매칭 3개 이하로 raw(정규화) 폴백 사용 여부 */
  usedFallback: boolean;
};

export type IngredientsParsePipelineOptions = {
  /**
   * 향후 GPT 등으로 후보 보정 시 주입
   * null 반환 시 기존 ingredients 유지
   */
  refine?: (ctx: {
    normalizedText: string;
    candidates: string[];
    usedFallback: boolean;
  }) => Promise<string[] | null>;
};

/** 줄바꿈 제거 · 공백 정리 · 불필요 특수문자 제거 (한글·영문·숫자·공백 위주 유지) */
export function normalizeText(text: string): string {
  const noBreaks = text.replace(/\r\n|\r|\n/g, " ");
  const collapsed = noBreaks.replace(/\s+/g, " ").trim();
  const cleaned = collapsed.replace(
    /[^\p{L}\p{N}\s가-힣a-zA-Z0-9.,%]/gu,
    " "
  );
  return cleaned.replace(/\s+/g, " ").trim();
}

/**
 * 사전(INGREDIENT_DICT)에 정의된 단어만, 긴 항목 우선으로 본문에서 추출
 */
/*export function extractIngredients(normalized: string): string[] {
  if (!normalized) {
    return [];
  }

  const sorted = [...INGREDIENT_DICT].sort(
    (a, b) => b.length - a.length || a.localeCompare(b, "ko")
  );

  let mask = normalized;
  const found: string[] = [];
  const seen = new Set<string>();

  for (const term of sorted) {
    const t = term.trim();
    if (t.length < 2) continue;

    if (mask.includes(t)) {
      if (!seen.has(t)) {
        seen.add(t);
        found.push(t);
      }
      mask = mask.split(t).join(" ");
    }
  }

  mask = mask.replace(/\s+/g, " ").trim();
  console.log("[ingredients-parse] extractIngredients mask-잔여.length:", mask.length);
  console.log("[ingredients-parse] extractIngredients mask-잔여 전체:\n", mask);

  return found;
}*/

/*export function extractIngredientsBlock(text: string): string {
  if (!text) return "";

  // 🔥 시작 키워드
  const startRegex = /사용한\s*원료의\s*명칭\s*[:：]/;

  // 🔥 끝 키워드 (여러 개 대응)
  const endRegex = /(※|\*등록성분량|등록성분량|조단백)/;

  const startMatch = text.match(startRegex);

  if (!startMatch || startMatch.index === undefined) {
    console.warn("❌ 원재료 시작 못 찾음");
    return "";
  }

  const startIdx = startMatch.index + startMatch[0].length;

  const rest = text.substring(startIdx);

  const endMatch = rest.match(endRegex);

  let block = "";

  if (endMatch && endMatch.index !== undefined) {
    block = rest.substring(0, endMatch.index);
  } else {
    block = rest;
  }

  // 🔥 줄바꿈 제거 + 정리
  block = block
    .replace(/\r\n|\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  console.log("🔥 추출된 원재료 블록:", block);

  return block;
}
export function parseIngredientsFromBlock(block: string): string[] {
  if (!block) return [];

  return block
    .split(/[,|]/) // 쉼표 + OCR 깨짐 대응
    .map(v =>
      v
        .replace(/\(.*?\)/g, "")   // 괄호 제거
        .replace(/[^\w가-힣]/g, "") // 특수문자 제거
        .trim()
    )
    .filter(v => v.length >= 2);
}*/
function cleanIngredientsBlock(block: string): string {
  if (!block) return "";

  // 🔥 "진짜 재료 시작 지점" 찾기
  const foodStartRegex = /(닭|소|돼지|연어|완두|곡류|쌀|옥수수)/;

  const match = block.match(foodStartRegex);

  if (match && match.index !== undefined) {
    const cleaned = block.substring(match.index);

    console.log("🔥 cleanBlock:", cleaned);

    return cleaned;
  }

  return block;
}

export function extractIngredientsBlock(text: string): string {
  if (!text) return "";

  // 🔥 유연한 시작 패턴 (핵심)
  const startPatterns = [
    /사용한\s*원료의\s*명칭\s*[:：]/,
    /원재료\s*[:：]/,
    /의\s*명칭\s+[가-힣]/ // ⭐ 이게 핵심 (OCR 깨짐 대응)
  ];

  let startIdx = -1;

  for (const pattern of startPatterns) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      startIdx = match.index + match[0].length;
      break;
    }
  }

  if (startIdx === -1) {
    console.warn("❌ 시작 못 찾음");
    return "";
  }

  const rest = text.substring(startIdx);

  // 🔥 끝 패턴
  const endPatterns = [
    /등록성분량/,
    /조단백/,
    /위\s*사용원료/,
  ];

  let endIdx = rest.length;

  for (const pattern of endPatterns) {
    const match = rest.match(pattern);
    if (match && match.index !== undefined) {
      endIdx = Math.min(endIdx, match.index);
    }
  }

  const block = rest.substring(0, endIdx);

  console.log("🔥 block:", block);

  return block;
}

export function parseIngredientsFromBlock(block: string): string[] {
  if (!block) return [];

  return block
    .replace(/\(.*?\)/g, "")   // 괄호 제거
    .replace(/[|]/g, ",")      // OCR 깨짐 대응
    .split(",")

    .map(v =>
      v
        .replace(/[^\w가-힣]/g, "")
        .trim()
    )
    .filter(v => v.length >= 2);
}


export function extractIngredients(normalized: string): string[] {
  if (!normalized) return [];

 // const block = extractIngredientsBlock(normalized);
  //const ingredients = parseIngredientsFromBlock(block);
  const block = extractIngredientsBlock(normalized);

  // 🔥 추가 (핵심)
  const cleanBlock = cleanIngredientsBlock(block);
  
  const ingredients = parseIngredientsFromBlock(cleanBlock);
  
  console.log("🔥 최종:", ingredients);
  console.log("🔥 원재료 블록:", block);

  if (!block) return [];

  const list = block
    // 🔥 줄바꿈 → 쉼표 변환
    .replace(/\n/g, ",")
    .replace(/[|]/g, ",")
    .replace(/[;；]/g, ",")
    .split(",")

    // 🔥 정제
    .map(v =>
      v
        .replace(/\(.*?\)/g, "") // 괄호 제거
        .replace(/[^\w가-힣]/g, "") // 특수문자 제거
        .trim()
    )

    // 🔥 필터
    .filter(v =>
      v.length >= 2 &&
      !/^(원료|성분|사용한|명칭)$/i.test(v)
    );

  // 🔥 중복 제거
  const unique = [...new Set(list)];

  console.log("🔥 최종 ingredients:", unique);

  return unique;
}

/*export function extractIngredients(normalized: string): string[] {
  if (!normalized) return [];

  // 🔥 긴 단어 우선 정렬 (핵심)
  const sorted = [...INGREDIENT_DICT].sort(
    (a, b) => b.length - a.length || a.localeCompare(b, "ko")
  );

  let mask = normalized;
  const found: string[] = [];
  const seen = new Set<string>();

  for (const term of sorted) {
    const t = term.trim();
    if (t.length < 2) continue;

    // 🔥 부분 매칭 방지 (핵심)
    const regex = new RegExp(t, "g");

    if (regex.test(mask)) {
      if (!seen.has(t)) {
        seen.add(t);
        found.push(t);
      }

      // 🔥 안전 제거 (split 대신 replace)
      mask = mask.replace(regex, " ");
    }
  }

  // 🔥 잔여 텍스트 정리
  mask = mask.replace(/\s+/g, " ").trim();

  console.log("[ingredients-parse] extractIngredients 결과:", found);
  console.log("[ingredients-parse] extractIngredients 잔여 텍스트:", mask);

  return found;
}*/
/**
 * normalize → extract → (3개 이하면 normalized 전체를 1원소로 폴백)
 * @see refine 옵션으로 이후 GPT 보정 레이어 연결 가능
 */
/*export function parseIngredientsSync(text: string): IngredientsParseResult {
  const normalizedText = normalizeText(text);
  console.log("[ingredients-parse] normalizeText.length:", normalizedText.length);
  console.log("[ingredients-parse] normalizeText 전체:\n", normalizedText);

  const candidates = extractIngredients(normalizedText);
  console.log("[ingredients-parse] 사전 매칭 개수:", candidates.length, candidates);

  const usedFallback = candidates.length <= 3;
  const ingredients =
    usedFallback && normalizedText.length > 0
      ? [normalizedText]
      : candidates;

  if (usedFallback) {
    console.log(
      "[ingredients-parse] fallback: 매칭 3개 이하 → normalized raw 1건 저장"
    );
  }

  return {
    ingredients,
    normalizedText,
    usedFallback,
  };
}*/
export function parseIngredientsSync(text: string): IngredientsParseResult {
  const normalizedText = normalizeText(text);

  console.log("[ingredients-parse] normalizeText.length:", normalizedText.length);
  console.log("[ingredients-parse] normalizeText 전체:\n", normalizedText);

  const candidates = extractIngredients(normalizedText);

  console.log("[ingredients-parse] 사전 매칭 개수:", candidates.length, candidates);

  function isValidIngredients(list: string[]) {
    if (!list || list.length === 0) return false;

    const valid = list.filter(v => v.length >= 2);

    const hasMain =
      valid.some(v =>
        ["닭", "소", "연어", "쌀", "옥수수", "완두"].some(k => v.includes(k))
      );

    return valid.length >= 3 && hasMain;
  }

  const isValid = isValidIngredients(candidates);
  const usedFallback = !isValid;

  const ingredients =
    usedFallback && normalizedText.length > 0
      ? [normalizedText]
      : candidates;

  if (usedFallback) {
    console.log("🔥 fallback 사용 (품질 기준 미달)");
  }

  return {
    ingredients,
    normalizedText,
    usedFallback,
  };
}
export async function parseIngredients(
  text: string,
  options?: IngredientsParsePipelineOptions
): Promise<IngredientsParseResult> {
  const base = parseIngredientsSync(text);

  if (!options?.refine) {
    return base;
  }

  try {
    const refined = await options.refine({
      normalizedText: base.normalizedText,
      candidates: base.usedFallback ? [] : base.ingredients,
      usedFallback: base.usedFallback,
    });
    if (refined && refined.length > 0) {
      console.log("[ingredients-parse] refine 적용:", refined);
      return {
        ...base,
        ingredients: refined,
        usedFallback: false,
      };
    }
  } catch (e) {
    console.error("[ingredients-parse] refine 실패, 동기 결과 유지", e);
  }

  return base;
}
