import { NextResponse } from "next/server";
import type { ScoredFood } from "@/lib/recommend";
import {
  extractDogProfile,
  generateFoodReason,
  type DogProfileForReason,
  type FoodReasonAiContext,
} from "@/lib/food-reason-openai";

function isScoredFoodRow(x: unknown): x is ScoredFood {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "number" &&
    typeof o.name === "string" &&
    typeof o.protein === "number" &&
    typeof o.fat === "number" &&
    typeof o.carb === "number" &&
    typeof o.purpose === "string" &&
    Array.isArray(o.ingredients) &&
    o.ingredients.every((i) => typeof i === "string") &&
    typeof o.score === "number"
  );
}

export type FoodWithReason = ScoredFood & { reason: string };

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "요청 본문이 올바른 JSON이 아닙니다." },
        { status: 400 }
      );
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "본문이 객체여야 합니다." },
        { status: 400 }
      );
    }

    const rec = body as Record<string, unknown>;
    const rawFoods = rec.foods;
    if (!Array.isArray(rawFoods) || rawFoods.length === 0) {
      return NextResponse.json(
        { error: "foods 배열이 필요합니다." },
        { status: 400 }
      );
    }

    if (rawFoods.length > 25) {
      return NextResponse.json(
        { error: "foods는 최대 25개까지입니다." },
        { status: 400 }
      );
    }

    const foods: ScoredFood[] = [];
    for (const row of rawFoods) {
      if (!isScoredFoodRow(row)) {
        return NextResponse.json(
          { error: "foods 항목 형식이 올바르지 않습니다." },
          { status: 400 }
        );
      }
      foods.push(row);
    }

    const goal =
      typeof rec.goal === "string" && rec.goal.trim() !== ""
        ? rec.goal.trim()
        : "normal";
    const need =
      typeof rec.need === "string" && rec.need.trim() !== ""
        ? rec.need.trim()
        : "balanced";

    const ai: FoodReasonAiContext = { goal, need };
    const profile: DogProfileForReason = extractDogProfile(rec);

    const dataOut: FoodWithReason[] = [];
    for (const f of foods) {
      const rounded: ScoredFood = { ...f, score: Math.round(f.score) };
      const reason = await generateFoodReason(rounded, ai, apiKey, profile);
      dataOut.push({ ...rounded, reason });
    }

    return NextResponse.json({ data: dataOut });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[food-reasons] 예외", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
