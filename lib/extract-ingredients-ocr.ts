/**
 * OCR 원료 텍스트 → 표준 사전 기반 원료명 추출 (오타 보정 + 퍼지 매칭)
 */

export const INGREDIENT_DICTIONARY = [
  "닭고기",
  "완두콩",
  "곡류",
  "비트식이섬유",
  "닭간",
  "소기름",
  "타피오카전분",
  "카놀라유",
  "맥주효모",
  "강황",
] as const;

const DICT_SET = new Set<string>(INGREDIENT_DICTIONARY);

export const CORRECTION_MAP: Readonly<Record<string, string>> = {
  염회칼륨: "염화칼륨",
  탄산칼숨: "탄산칼슘",
  코코넷: "코코넛",
  콘그릿츠: "곡류",
  콘글루텐: "곡류",
};

const CORRECTION_ENTRIES = Object.entries(CORRECTION_MAP).sort(
  (a, b) => b[0].length - a[0].length
);

export const STOP_WORDS = [
  "DUSTRY",
  "WATS",
  "비타민제합제",
  "정제소금",
  "토코페롤",
  "효모추출물",
] as const;

const STOP_SET = new Set(
  STOP_WORDS.map((w) => w.toUpperCase()).concat(STOP_WORDS as unknown as string[])
);

const FUZZY_THRESHOLD = 0.6;

/** 괄호·특수구분자 제거, 허용 문자만 유지, 공백 정리 */
export function cleanText(text: string): string {
  let s = text.normalize("NFKC");
  s = s.replace(/[\[\]()|｜]/g, ",");
  s = s.replace(/[^\uAC00-\uD7A3a-zA-Z0-9\s,，、.\-]/g, " ");
  s = s.replace(/[,，、]+/g, ",");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** 쉼표·공백 기준 토큰 분리 */
export function tokenize(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function isStopWord(token: string): boolean {
  const t = token.trim();
  if (!t) return true;
  const upper = t.toUpperCase();
  if (STOP_SET.has(t) || STOP_SET.has(upper)) return true;
  return STOP_WORDS.some((w) => t === w || upper === w.toUpperCase());
}

/** 토큰 문자열에 오타 맵 적용 (긴 키 우선) */
export function applyCorrections(token: string): string {
  let s = token;
  for (const [wrong, right] of CORRECTION_ENTRIES) {
    if (s.includes(wrong)) {
      s = s.split(wrong).join(right);
    }
  }
  return s.trim();
}

/** Sørensen–Dice (바이그램) */
function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 && b.length < 2) return a === b ? 1 : 0;
  if (a.length < 2 || b.length < 2) {
    return a.includes(b) || b.includes(a) ? 0.5 : 0;
  }
  const bigramCounts = (str: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < str.length - 1; i++) {
      const bg = str.slice(i, i + 2);
      m.set(bg, (m.get(bg) ?? 0) + 1);
    }
    return m;
  };
  const A = bigramCounts(a);
  const B = bigramCounts(b);
  let inter = 0;
  for (const [bg, n] of A) {
    if (B.has(bg)) inter += Math.min(n, B.get(bg)!);
  }
  const total = a.length - 1 + (b.length - 1);
  return total === 0 ? 0 : (2 * inter) / total;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost
      );
    }
  }
  return dp[m]![n]!;
}

function levenshteinNormalized(a: string, b: string): number {
  const d = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length, 1);
  return 1 - d / maxLen;
}

/** 퍼지 유사도 (Dice와 정규화 Levenshtein 중 큰 값) */
export function stringSimilarity(a: string, b: string): number {
  const na = a.trim();
  const nb = b.trim();
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  return Math.max(diceCoefficient(na, nb), levenshteinNormalized(na, nb));
}

/**
 * 단일 토큰 → 사전 항목 또는 null (정확 일치 후 퍼지)
 */
export function matchToken(token: string): string | null {
  let t = token.trim();
  if (!t || isStopWord(t)) return null;

  t = applyCorrections(t);
  if (!t || isStopWord(t)) return null;

  if (DICT_SET.has(t)) return t;

  let best: string | null = null;
  let bestScore = 0;
  for (const dictItem of INGREDIENT_DICTIONARY) {
    const score = stringSimilarity(t, dictItem);
    if (score > bestScore) {
      bestScore = score;
      best = dictItem;
    }
  }

  if (best !== null && bestScore >= FUZZY_THRESHOLD) {
    return best;
  }
  return null;
}

/**
 * OCR 원본 → 표준 원료명 배열 (중복 제거, 등장 순서 유지)
 */
export function extractIngredients(text: string): string[] {
  const cleaned = cleanText(text);
  const tokens = tokenize(cleaned);
  const out: string[] = [];
  const seen = new Set<string>();

  for (const tok of tokens) {
    const m = matchToken(tok);
    if (m && !seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }

  return out;
}
