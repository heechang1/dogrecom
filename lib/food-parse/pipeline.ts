import type { FoodParsedSnapshot } from "@/lib/food-record";
import {
  cleanOcrLabelTextWithAI,
  parseFoodWithAI,
} from "@/lib/food-parse/ai-openai";
import { buildFallbackParsed } from "@/lib/food-parse/fallback";
import {
  isParsedUsable,
  postProcessAiFoodJson,
} from "@/lib/food-parse/postprocess";
import type { FoodParsePipelineResult } from "@/lib/food-parse/types";

export type FoodParsePipelineOptions = {
  /** true: 텍스트 전용 정제 API 1회 후 JSON 파싱 (OpenAI 2회) */
  preCleanText?: boolean;
};

/**
 * 텍스트 OCR 결과 → (선택) 문장 정제 → AI JSON → 후처리 → (실패 시) 폴백
 */
export async function runFoodTextParsePipeline(
  rawText: string,
  apiKey: string,
  options?: FoodParsePipelineOptions
): Promise<FoodParsePipelineResult> {
  const raw_ocr = rawText;

  console.log("[food-parse/pipeline] raw OCR text.length:", raw_ocr.length);
  console.log("[food-parse/pipeline] raw OCR 전체 텍스트:\n", raw_ocr);

  let textForJson = raw_ocr;
  if (options?.preCleanText) {
    try {
      textForJson = await cleanOcrLabelTextWithAI(raw_ocr, apiKey);
      console.log(
        "[food-parse/pipeline] preClean 후 길이:",
        textForJson.length
      );
    } catch (e) {
      console.error("[food-parse/pipeline] preClean 실패, 원문으로 JSON 시도", e);
      textForJson = raw_ocr;
    }
  }

  let aiRaw: unknown;
  try {
    aiRaw = await parseFoodWithAI(textForJson, apiKey);
    console.log("[food-parse/pipeline] AI 결과(raw):", JSON.stringify(aiRaw));
  } catch (e) {
    console.error("[food-parse/pipeline] AI 호출 실패 → fallback", e);
    const parsed = buildFallbackParsed(raw_ocr);
    console.log(
      "[food-parse/pipeline] 최종 저장 데이터(fallback):",
      JSON.stringify({ raw_ocr, parsed, fallbackUsed: true })
    );
    return { raw_ocr, parsed, fallbackUsed: true };
  }

  let parsed: FoodParsedSnapshot = postProcessAiFoodJson(aiRaw);
  let fallbackUsed = !isParsedUsable(parsed);

  if (fallbackUsed) {
    console.warn(
      "[food-parse/pipeline] 후처리 결과 검증 실패 → fallback",
      JSON.stringify(parsed)
    );
    parsed = buildFallbackParsed(raw_ocr);
  }

  console.log(
    "[food-parse/pipeline] 최종 저장 데이터:",
    JSON.stringify({ raw_ocr, parsed, fallbackUsed })
  );

  return { raw_ocr, parsed, fallbackUsed };
}
