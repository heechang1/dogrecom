import { extractStructuredProductFromOcr } from "@/lib/ocr-structured-product-extract";
import { generatePetFoodSummaryOpenAI } from "@/lib/ocr-food-summary-openai";

export type OcrPetFoodPipelineResult = {
  name: string;
  brand: string;
  weight: number | null;
  protein: number | null;
  fat: number | null;
  fiber: number | null;
  ash: number | null;
  moisture: number | null;
  category: string;
  summary: string;
};

export { classifyCategoryFromIngredientBlock } from "@/lib/ocr-structured-product-extract";

function formatNutritionForPrompt(p: {
  protein: number | null;
  fat: number | null;
  fiber: number | null;
  ash: number | null;
  moisture: number | null;
}): string {
  const parts: string[] = [];
  if (p.protein !== null) {
    parts.push(`조단백 ${p.protein}%`);
  }
  if (p.fat !== null) {
    parts.push(`조지방 ${p.fat}%`);
  }
  if (p.fiber !== null) {
    parts.push(`조섬유 ${p.fiber}%`);
  }
  if (p.ash !== null) {
    parts.push(`조회분 ${p.ash}%`);
  }
  if (p.moisture !== null) {
    parts.push(`수분 ${p.moisture}%`);
  }
  return parts.join(", ");
}

/**
 * 블록 병합 OCR + 원재료 블록 → 구조화 필드 + (선택) OpenAI 요약.
 * OPENAI_API_KEY 없으면 summary 는 빈 문자열.
 */
export async function runOcrPetFoodPipeline(
  rawOcrFromBlocks: string,
  ingredientBlock: string
): Promise<OcrPetFoodPipelineResult> {
  const base = extractStructuredProductFromOcr(
    rawOcrFromBlocks,
    ingredientBlock
  );

  const nutritionText = formatNutritionForPrompt({
    protein: base.protein,
    fat: base.fat,
    fiber: base.fiber,
    ash: base.ash,
    moisture: base.moisture,
  });

  const summary = await generatePetFoodSummaryOpenAI({
    name: base.name,
    ingredients: ingredientBlock,
    nutritionText,
  });

  console.log("SUMMARY:", summary);

  return {
    ...base,
    summary,
  };
}
