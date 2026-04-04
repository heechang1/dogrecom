export type ScoreFood = {
  name: string;
  protein: number;
  fat: number;
  carb: number;
  purpose: string;
};

export type ScoreAIResult = {
  goal: string;
  need: string;
};

export function calculateScore(food: ScoreFood, ai: ScoreAIResult): number {
  let score = 0;

  if (ai.goal === "diet") {
    score += (20 - food.fat) * 2;
    score += food.protein * 1.5;
  } else if (ai.goal === "muscle") {
    score += food.protein * 2.5;
    score += Math.max(0, 16 - food.fat) * 0.8;
  } else {
    score += 30;
    score += food.protein * 0.8;
    score += Math.max(0, 20 - Math.abs(food.carb - 38)) * 0.15;
  }

  return score;
}
