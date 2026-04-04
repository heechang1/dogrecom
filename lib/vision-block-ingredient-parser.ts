/**
 * Google Vision DOCUMENT_TEXT_DETECTION — 블록 계열만 사용.
 * fullTextAnnotation.text 는 사용하지 않음 (평면화 누락 방지).
 *
 * 원재료 구간은 길이·블록 개수로 자르지 않고, 시작 블록부터 정지 키워드 블록 전까지 순차 병합합니다.
 */

import {
  reconstructBlockText,
  type FullTextAnnotation,
  type VisionBlock,
} from "@/lib/google-vision-structured-ocr";
import { processIngredientBlock } from "@/lib/ingredient-block-clean";

export type BlockBasedVisionResult = {
  rawBlocks: string[];
  ingredientBlock: string;
  ingredients: string[];
};

const KEYWORDS = ["원료", "원재료", "닭", "쌀", "옥수수", "육분"];

/** 블록 본문에 포함되면 해당 블록은 붙이지 않고 병합 종료 */
const MERGE_STOP_MARKERS = [
  "등록성분",
  "등록 성분",
  "조단백",
  "성분량",
  "급여방법",
  "주의사항",
];

/**
 * pages → blocks → paragraphs → words → symbols (reconstructBlockText)
 */
export function extractRawBlocksFromFullTextAnnotation(
  fta: FullTextAnnotation | null | undefined
): string[] {
  if (!fta || typeof fta !== "object") {
    return [];
  }
  const pages = fta.pages;
  if (!pages || !Array.isArray(pages) || pages.length === 0) {
    return [];
  }

  const out: string[] = [];
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
      const t = reconstructBlockText(blocks[bi] as VisionBlock);
      if (t !== "") {
        out.push(t);
      }
    }
  }
  return out;
}

function countCommas(s: string): number {
  const m = s.match(/,/g);
  return m ? m.length : 0;
}

function keywordScore(s: string): number {
  let n = 0;
  for (let i = 0; i < KEYWORDS.length; i += 1) {
    if (s.indexOf(KEYWORDS[i]) >= 0) {
      n += 1;
    }
  }
  return n;
}

/**
 * 쉼표 수 우선, 동점·보조로 키워드 (원료 없는 라벨용 폴백)
 */
export function findCandidateBlockIndex(blocks: string[]): number {
  if (blocks.length === 0) {
    return -1;
  }
  let bestIdx = 0;
  let bestCommas = -1;
  let bestKw = -1;

  for (let i = 0; i < blocks.length; i += 1) {
    const c = countCommas(blocks[i]);
    const k = keywordScore(blocks[i]);
    if (c > bestCommas || (c === bestCommas && k > bestKw)) {
      bestCommas = c;
      bestKw = k;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * "원료" 포함 블록 중 쉼표가 가장 많은 블록 인덱스.
 * 없으면 쉼표·키워드 기반 후보 인덱스.
 */
export function findIngredientStartBlockIndex(blocks: string[]): number {
  if (blocks.length === 0) {
    return -1;
  }
  let bestWithWonryo = -1;
  let bestCommasWonryo = -1;
  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i];
    if (b.includes("원료")) {
      const c = countCommas(b);
      if (c > bestCommasWonryo) {
        bestCommasWonryo = c;
        bestWithWonryo = i;
      }
    }
  }
  if (bestWithWonryo >= 0) {
    return bestWithWonryo;
  }
  return findCandidateBlockIndex(blocks);
}

/**
 * startIndex 블록부터 순서대로 이어붙이다가, 정지 마커가 들어 있는 블록에서 끊음 (해당 블록 미포함).
 */
export function mergeUntilStop(blocks: string[], startIndex: number): string {
  if (blocks.length === 0) {
    return "";
  }
  const i0 = Math.max(0, Math.min(startIndex, blocks.length - 1));
  let result = "";

  for (let i = i0; i < blocks.length; i += 1) {
    const block = blocks[i];
    let stop = false;
    for (let m = 0; m < MERGE_STOP_MARKERS.length; m += 1) {
      if (block.includes(MERGE_STOP_MARKERS[m])) {
        stop = true;
        break;
      }
    }
    if (stop) {
      break;
    }
    result += (result ? " " : "") + block;
  }

  return result.replace(/\s+/g, " ").trim();
}

/**
 * annotate 응답에서 fullTextAnnotation 객체만 추출
 */
export function getFullTextAnnotationFromAnnotateResponse(
  data: unknown
): FullTextAnnotation | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const responses = (data as { responses?: unknown }).responses;
  if (!Array.isArray(responses) || responses.length === 0) {
    return null;
  }
  const first = responses[0];
  if (!first || typeof first !== "object") {
    return null;
  }
  const fta = (first as { fullTextAnnotation?: FullTextAnnotation })
    .fullTextAnnotation;
  if (!fta || typeof fta !== "object") {
    return null;
  }
  return fta;
}

/**
 * fullTextAnnotation.text 를 읽지 않음.
 */
export function processBlockBasedVisionOCR(
  fullTextAnnotation: FullTextAnnotation | null | undefined
): BlockBasedVisionResult {
  const rawBlocks = extractRawBlocksFromFullTextAnnotation(fullTextAnnotation);

  console.log("BLOCKS:", rawBlocks);

  if (rawBlocks.length === 0) {
    return {
      rawBlocks: [],
      ingredientBlock: "",
      ingredients: [],
    };
  }

  const startIndex = findIngredientStartBlockIndex(rawBlocks);
  console.log("START INDEX:", startIndex);

  const mergedResult = mergeUntilStop(rawBlocks, startIndex);
  console.log("MERGED RESULT:", mergedResult);

  const { cleanedBlock: ingredientBlock, ingredients } =
    processIngredientBlock(mergedResult);

  return {
    rawBlocks,
    ingredientBlock,
    ingredients,
  };
}
