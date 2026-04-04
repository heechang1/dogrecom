import { NextResponse } from "next/server";
import { appendFeedLog } from "@/lib/feed-log-store";

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch (e) {
      console.error("[feed] JSON 파싱 실패", e);
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
    const dogIdRaw = o.dogId;
    const dogId =
      typeof dogIdRaw === "string"
        ? dogIdRaw.trim()
        : typeof dogIdRaw === "number" && Number.isFinite(dogIdRaw)
          ? String(dogIdRaw)
          : "";

    const amount = o.amount;
    const amountNum =
      typeof amount === "number" && Number.isFinite(amount) && amount > 0
        ? amount
        : typeof amount === "string" && amount.trim() !== ""
          ? Number(amount)
          : NaN;

    if (!dogId) {
      return NextResponse.json(
        { success: false, error: "dogId가 필요합니다." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { success: false, error: "amount는 0보다 큰 숫자여야 합니다." },
        { status: 400 }
      );
    }

    appendFeedLog(dogId, amountNum);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[feed] POST 처리 오류", e);
    return NextResponse.json(
      { success: false, error: "기록 저장 실패" },
      { status: 500 }
    );
  }
}
