/**
 * Google Cloud Vision — DOCUMENT_TEXT_DETECTION (documentTextDetection)
 * 응답의 fullTextAnnotation 계층을 파싱합니다.
 *
 * plain fullTextAnnotation.text 만 쓰면 표 레이아웃에서 순서/누락이 생길 수 있어,
 * pages → blocks → paragraphs → words → symbols 를 따라 블록 단위로 복원합니다.
 *
 * REST features[].type: "DOCUMENT_TEXT_DETECTION" 사용 (TEXT_DETECTION 아님).
 */

import { parseIngredients } from "@/lib/ocr-ingredient-pipeline";

export type StructuredOCRResult = {
  rawText: string;
  blocks: string[];
  ingredientBlock: string;
  ingredients: string[];
};

/** Vision API JSON (일부 필드만) */
export type VisionSymbol = {
  text?: string;
};

export type VisionWord = {
  /** 일부 응답에서만 존재 */
  text?: string;
  symbols?: VisionSymbol[];
};

export type VisionParagraph = {
  words?: VisionWord[];
};

export type VisionBlock = {
  paragraphs?: VisionParagraph[];
};

export type VisionPage = {
  blocks?: VisionBlock[];
};

export type FullTextAnnotation = {
  text?: string;
  pages?: VisionPage[];
};

const INGREDIENT_KEYWORDS = [
  "닭",
  "쌀",
  "옥수수",
  "육분",
  "연어",
  "완두",
  "소",
  "생선",
  "전분",
  "곡물",
  "미트",
  "치킨",
];

function countCommas(s: string): number {
  const m = s.match(/,/g);
  return m ? m.length : 0;
}

function countKeywordHits(s: string): number {
  let n = 0;
  for (let i = 0; i < INGREDIENT_KEYWORDS.length; i += 1) {
    if (s.indexOf(INGREDIENT_KEYWORDS[i]) >= 0) {
      n += 1;
    }
  }
  return n;
}

function scoreBlockText(text: string): number {
  return countCommas(text) * 10 + countKeywordHits(text) * 8;
}

/**
 * 단어: symbols[].text 이어붙이기 (Vision 기본 구조)
 */
export function getWordText(word: VisionWord | null | undefined): string {
  if (!word || typeof word !== "object") {
    return "";
  }
  if (typeof word.text === "string" && word.text !== "") {
    return word.text;
  }
  const syms = word.symbols;
  if (!syms || !Array.isArray(syms)) {
    return "";
  }
  let out = "";
  for (let i = 0; i < syms.length; i += 1) {
    const t = syms[i];
    if (t && typeof t.text === "string") {
      out += t.text;
    }
  }
  return out;
}

/**
 * 문단: 단어 사이 공백으로 연결 (한글/영문 혼합 OCR 대비)
 */
export function getParagraphText(paragraph: VisionParagraph | null | undefined): string {
  if (!paragraph || typeof paragraph !== "object") {
    return "";
  }
  const words = paragraph.words;
  if (!words || !Array.isArray(words)) {
    return "";
  }
  const parts: string[] = [];
  for (let i = 0; i < words.length; i += 1) {
    const w = getWordText(words[i]);
    if (w !== "") {
      parts.push(w);
    }
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * 블록: 문단을 공백으로 이어붙임
 */
export function reconstructBlockText(block: VisionBlock | null | undefined): string {
  if (!block || typeof block !== "object") {
    return "";
  }
  const paras = block.paragraphs;
  if (!paras || !Array.isArray(paras)) {
    return "";
  }
  const parts: string[] = [];
  for (let i = 0; i < paras.length; i += 1) {
    const p = getParagraphText(paras[i]);
    if (p !== "") {
      parts.push(p);
    }
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * fullTextAnnotation 에서 블록별 문자열 배열 추출
 */
export function extractBlocksFromAnnotation(
  annotation: FullTextAnnotation | null | undefined
): string[] {
  if (!annotation || typeof annotation !== "object") {
    return [];
  }

  const pages = annotation.pages;
  if (!pages || !Array.isArray(pages) || pages.length === 0) {
    if (typeof annotation.text === "string" && annotation.text.trim() !== "") {
      return [annotation.text.replace(/\s+/g, " ").trim()];
    }
    return [];
  }

  const blocksOut: string[] = [];
  for (let pi = 0; pi < pages.length; pi += 1) {
    const page = pages[pi];
    if (!page || typeof page !== "object") {
      continue;
    }
    const blocks = page.blocks;
    if (!blocks || !Array.isArray(blocks)) {
      continue;
    }
    for (let bi = 0; bi < blocks.length; bi += 1) {
      const t = reconstructBlockText(blocks[bi]);
      if (t !== "") {
        blocksOut.push(t);
      }
    }
  }

  if (blocksOut.length === 0 && typeof annotation.text === "string") {
    return [annotation.text.replace(/\s+/g, " ").trim()];
  }

  return blocksOut;
}

/**
 * 인접 블록 병합 (표에서 원재료가 블록 경계로 나뉜 경우)
 */
function mergeNearbyBlocks(blocks: string[], centerIndex: number): string {
  if (blocks.length === 0) {
    return "";
  }
  const i = Math.max(0, Math.min(centerIndex, blocks.length - 1));
  const parts: string[] = [];
  if (i > 0) {
    parts.push(blocks[i - 1]);
  }
  parts.push(blocks[i]);
  if (i < blocks.length - 1) {
    parts.push(blocks[i + 1]);
  }

  const centerAlone = blocks[i];
  const aloneCommas = countCommas(centerAlone);
  const aloneKw = countKeywordHits(centerAlone);

  if (aloneCommas >= 5 && aloneKw >= 1) {
    return centerAlone;
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * 원재료 후보 블록 선택: 쉼표 밀도 + 키워드 점수
 */
export function selectIngredientBlock(blocks: string[]): {
  index: number;
  text: string;
} {
  if (blocks.length === 0) {
    return { index: -1, text: "" };
  }

  let bestIdx = 0;
  let bestScore = -1;

  for (let i = 0; i < blocks.length; i += 1) {
    const sc = scoreBlockText(blocks[i]);
    if (sc > bestScore) {
      bestScore = sc;
      bestIdx = i;
    }
  }

  const merged = mergeNearbyBlocks(blocks, bestIdx);
  return { index: bestIdx, text: merged };
}

/**
 * Vision `responses[0].fullTextAnnotation` 또는 동일 객체를 넣습니다.
 */
export function processStructuredOCR(
  fullTextAnnotation: FullTextAnnotation | null | undefined
): StructuredOCRResult {
  const annotation =
    fullTextAnnotation && typeof fullTextAnnotation === "object"
      ? fullTextAnnotation
      : null;

  const blocks = extractBlocksFromAnnotation(annotation);

  const rawText =
    annotation && typeof annotation.text === "string"
      ? annotation.text
      : blocks.join(" ");

  console.log("BLOCKS:", blocks);

  const selected = selectIngredientBlock(blocks);
  const ingredientBlock = selected.text;

  console.log("SELECTED BLOCK:", ingredientBlock);

  const ingredients = parseIngredients(ingredientBlock);

  return {
    rawText,
    blocks,
    ingredientBlock,
    ingredients,
  };
}

/**
 * `images:annotate` 전체 응답 JSON에서 첫 번째 fullTextAnnotation 추출 후 처리
 */
export function processStructuredOCRFromAnnotateResponse(data: unknown): StructuredOCRResult | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const responses = (data as { responses?: unknown }).responses;
  if (!responses || !Array.isArray(responses) || responses.length === 0) {
    return null;
  }
  const first = responses[0];
  if (!first || typeof first !== "object") {
    return null;
  }
  const fta = (first as { fullTextAnnotation?: FullTextAnnotation })
    .fullTextAnnotation;
  if (!fta) {
    return {
      rawText: "",
      blocks: [],
      ingredientBlock: "",
      ingredients: [],
    };
  }
  return processStructuredOCR(fta);
}
