import { NextResponse } from "next/server";
import {
  appendFeedLog,
  getTodayFeedTotalGrams,
} from "@/lib/feed-log-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
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
    const o = body as Record<string, unknown>;

    const dogIdRaw = o.dogId;
    const dogId =
      typeof dogIdRaw === "string"
        ? dogIdRaw.trim()
        : typeof dogIdRaw === "number" && Number.isFinite(dogIdRaw)
          ? String(dogIdRaw)
          : "1";

    const amountNum =
      typeof o.amountG === "number" && Number.isFinite(o.amountG) && o.amountG > 0
        ? o.amountG
        : typeof o.amountG === "string" && o.amountG.trim() !== ""
          ? Number(o.amountG)
          : NaN;

    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { success: false, error: "amountG가 필요합니다." },
        { status: 400 }
      );
    }

    const foodName =
      typeof o.foodName === "string" ? o.foodName.trim() : undefined;
    const period =
      o.period === "morning" || o.period === "evening" ? o.period : undefined;
    const reaction =
      o.reaction === "good" || o.reaction === "ok" || o.reaction === "bad"
        ? o.reaction
        : undefined;
    const kcal =
      typeof o.kcal === "number" && Number.isFinite(o.kcal) ? o.kcal : undefined;
    const recommendedAmount =
      typeof o.recommendedAmount === "number" &&
      Number.isFinite(o.recommendedAmount)
        ? o.recommendedAmount
        : undefined;

    appendFeedLog(dogId, amountNum, {
      foodName,
      period,
      reaction,
      kcal,
      recommendedAmount,
    });

    const todayTotalG = getTodayFeedTotalGrams(dogId);

    return NextResponse.json({
      success: true,
      todayTotalG,
      dogId,
    });
  } catch (e) {
    console.error("[feed/track] POST 오류", e);
    return NextResponse.json(
      { success: false, error: "저장 실패" },
      { status: 500 }
    );
  }
}
