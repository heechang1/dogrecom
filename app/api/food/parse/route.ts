import { NextResponse } from "next/server";
import { runFoodTextParsePipeline } from "@/lib/food-parse/pipeline";
import { appendFoodFromAiParse } from "@/lib/foods-store";

export const runtime = "nodejs";
export const maxDuration = 120;

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
    } catch (e) {
      console.error("[food/parse] JSON 파싱 실패", e);
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "본문이 객체여야 합니다." }, { status: 400 });
    }

    const bodyObj = body as Record<string, unknown>;
    const rawIncoming =
      typeof bodyObj.rawText === "string" ? bodyObj.rawText : "";
    console.log("[food/parse] 요청 payload 키:", Object.keys(bodyObj));
    console.log("[food/parse] rawText.length (수신 직후):", rawIncoming.length);
    console.log("[food/parse] rawText 전체 (수신):\n", rawIncoming);

    if (!rawIncoming.trim()) {
      return NextResponse.json(
        { error: "rawText 문자열이 필요합니다." },
        { status: 400 }
      );
    }

    const persist = (body as { persist?: unknown }).persist === true;
    const preCleanText = (body as { preCleanText?: unknown }).preCleanText === true;

    const result = await runFoodTextParsePipeline(rawIncoming, apiKey, {
      preCleanText,
    });

    let saved = null as ReturnType<typeof appendFoodFromAiParse> | null;
    if (persist) {
      saved = appendFoodFromAiParse(result.raw_ocr, result.parsed);
      console.log("[food/parse] DB 저장됨 id=", saved.id);
    }

    return NextResponse.json({
      success: true,
      raw_ocr: result.raw_ocr,
      parsed: result.parsed,
      fallbackUsed: result.fallbackUsed,
      ...(saved ? { food: saved } : {}),
    });
  } catch (e) {
    console.error("[food/parse] 예외", e);
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "처리 실패",
      },
      { status: 500 }
    );
  }
}
