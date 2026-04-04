import { NextResponse } from "next/server";
import type { FoodCategory, FoodDraft } from "@/lib/food-record";
import { appendFoodDraft } from "@/lib/foods-store";

export const runtime = "nodejs";

function isCategory(x: unknown): x is FoodCategory {
  return x === "diet" || x === "normal" || x === "hypoallergenic";
}

function bodyToDraft(body: Record<string, unknown>): FoodDraft | null {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return null;
  }

  const num = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = parseFloat(v.replace(/,/g, ""));
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  const protein = num(body.protein);
  const fat = num(body.fat);
  const fiber = num(body.fiber);
  if (protein === null || fat === null || fiber === null) {
    return null;
  }

  let tags: string[] = [];
  if (Array.isArray(body.tags)) {
    tags = body.tags.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean);
  } else if (typeof body.tags === "string") {
    tags = body.tags
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
  }
  if (tags.length === 0) {
    return null;
  }

  const category = body.category;
  if (!isCategory(category)) {
    return null;
  }

  let ingredients: string[] = [];
  if (Array.isArray(body.ingredients)) {
    ingredients = body.ingredients
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean);
  } else if (typeof body.ingredients === "string") {
    ingredients = body.ingredients
      .split(/[,，、\n]/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  const brand = typeof body.brand === "string" ? body.brand.trim() : "";
  const feature = typeof body.feature === "string" ? body.feature : "";
  const kcal = num(body.kcal);

  let target: string[] = [];
  if (Array.isArray(body.target)) {
    target = body.target
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  return {
    name,
    brand,
    protein,
    fat,
    fiber,
    kcal,
    ingredients,
    tags,
    feature,
    target,
    category,
  };
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch (e) {
      console.error("[food/save] JSON 파싱 실패", e);
      return NextResponse.json(
        { success: false, error: "Invalid JSON" },
        { status: 400 }
      );
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { success: false, error: "본문이 객체여야 합니다." },
        { status: 400 }
      );
    }

    const draft = bodyToDraft(body as Record<string, unknown>);
    if (!draft) {
      return NextResponse.json(
        {
          success: false,
          error:
            "필수: name, protein, fat, fiber(숫자), tags(1개 이상), category",
        },
        { status: 400 }
      );
    }

    const saved = appendFoodDraft(draft);
    console.log("[food/save] 저장됨:", saved.id, saved.name);

    return NextResponse.json({ success: true, food: saved });
  } catch (e) {
    console.error("[food/save] 오류", e);
    return NextResponse.json(
      { success: false, error: "저장 실패" },
      { status: 500 }
    );
  }
}
