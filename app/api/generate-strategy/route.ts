import { NextResponse } from "next/server";
import {
  fallbackStrategyForBreed,
  normalizeStrategy,
} from "@/lib/breed-strategy";

const SYSTEM_PROMPT = `
너는 반려견 영양 전문가다.

견종을 기반으로 사료 추천 전략을 JSON으로 생성해라.

출력 형식:
{
  "size": "",
  "activityLevel": "",
  "obesityRisk": "",
  "allergyRisk": "",
  "recommendedProtein": "",
  "recommendedFat": ""
}

JSON만 반환해라.
`.trim();

type OpenAIChatResponse = {
  error?: { message?: string };
  choices?: Array<{ message?: { content?: string | null } }>;
};

export async function POST(req: Request) {
  try {
    let breed = "";
    try {
      const body = (await req.json()) as { breed?: unknown };
      if (typeof body.breed === "string" && body.breed.trim()) {
        breed = body.breed.trim();
      }
    } catch (e) {
      console.error("[generate-strategy] JSON 파싱 실패", e);
      return NextResponse.json(
        { error: "JSON 본문이 필요합니다." },
        { status: 400 }
      );
    }

    if (!breed) {
      return NextResponse.json(
        { error: "breed 문자열이 필요합니다." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log(
        "[generate-strategy] OPENAI_API_KEY 없음 → fallback 전략 사용"
      );
      const fb = fallbackStrategyForBreed(breed);
      return NextResponse.json(fb);
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `견종: ${breed}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.35,
      }),
    });

    const data = (await res.json()) as OpenAIChatResponse;

    if (!res.ok) {
      console.error(
        "[generate-strategy] OpenAI 오류",
        data.error?.message ?? res.status
      );
      return NextResponse.json(fallbackStrategyForBreed(breed));
    }

    const choice = data.choices?.[0];
    const raw = choice?.message?.content;
    if (choice == null || typeof raw !== "string" || !raw.trim()) {
      console.error("[generate-strategy] 응답 content 없음");
      return NextResponse.json(fallbackStrategyForBreed(breed));
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch (e) {
      console.error("[generate-strategy] JSON.parse 실패", e);
      return NextResponse.json(fallbackStrategyForBreed(breed));
    }

    const strategy = normalizeStrategy(parsed);
    console.log("[generate-strategy] 생성 완료:", breed, strategy);

    return NextResponse.json(strategy);
  } catch (e) {
    console.error("[generate-strategy] 예외", e);
    return NextResponse.json(
      fallbackStrategyForBreed("믹스"),
      { status: 200 }
    );
  }
}
