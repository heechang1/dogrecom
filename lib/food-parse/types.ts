import type { FoodParsedSnapshot } from "@/lib/food-record";

export type { FoodParsedSnapshot };

export type FoodParsePipelineResult = {
  raw_ocr: string;
  parsed: FoodParsedSnapshot;
  fallbackUsed: boolean;
};
