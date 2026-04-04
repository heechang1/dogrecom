import foodsJson from "@/data/foods.json";
import type { FoodRecord } from "./food-record";
import { calculateScore } from "./score";

export type AIResult = {
  goal: string;
  need: string;
  type: string[];
};

const foods = foodsJson as FoodRecord[];

export type Food = FoodRecord;

export type ScoredFood = FoodRecord & { score: number };

export function recommendFoods(ai: AIResult): ScoredFood[] {
  let result: Food[] = [...foods];

  if (ai.goal === "diet") {
    result = result.filter((f) => f.purpose === "diet");
  }

  if (ai.need === "low_fat") {
    result = result.filter((f) => f.fat <= 15);
  }

  if (ai.need === "high_protein") {
    result = result.filter((f) => f.protein >= 26);
  }

  if (ai.need === "balanced") {
    result = result.filter(
      (f) => f.fat >= 8 && f.fat <= 16 && f.protein >= 24 && f.protein <= 30
    );
  }

  const scored: ScoredFood[] = result.map((f) => ({
    ...f,
    score: calculateScore(f, ai),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored;
}
