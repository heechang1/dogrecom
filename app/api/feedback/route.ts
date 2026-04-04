import { NextResponse } from "next/server";
import {
  applyFoodFeedback,
  readFoodFeedbackAdjustments,
} from "@/lib/food-feedback-store";

export async function GET() {
  try {
    const adjustments = readFoodFeedbackAdjustments();
    return NextResponse.json({ success: true, adjustments });
  } catch (e) {
    console.error("[feedback] GET 오류", e);
    return NextResponse.json(
      { success: false, error: "adjustments 읽기 실패" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch (e) {
      console.error("[feedback] JSON 파싱 실패", e);
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { success: false, error: "본문이 객체여야 합니다." },
        { status: 400 }
      );
    }

    const o = body as Record<string, unknown>;
    const foodIdRaw = o.foodId;
    const foodId =
      typeof foodIdRaw === "string"
        ? foodIdRaw.trim()
        : typeof foodIdRaw === "number" && Number.isFinite(foodIdRaw)
          ? String(foodIdRaw)
          : "";

    let feedback = o.feedback;
    if (feedback === undefined && o.type !== undefined) {
      feedback = o.type;
    }

    if (!foodId) {
      return NextResponse.json(
        { success: false, error: "foodId가 필요합니다." },
        { status: 400 }
      );
    }

    if (feedback !== "like" && feedback !== "dislike") {
      return NextResponse.json(
        { success: false, error: 'feedback는 "like" 또는 "dislike"여야 합니다.' },
        { status: 400 }
      );
    }

    applyFoodFeedback(foodId, feedback);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[feedback] POST 처리 오류", e);
    return NextResponse.json(
      { success: false, error: "저장 실패" },
      { status: 500 }
    );
  }
}
