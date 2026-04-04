import { NextResponse } from "next/server";
import { recommendFoods } from "@/lib/recommend";
import type { ScoredFood } from "@/lib/recommend";
import {
  extractDogProfile,
  generateFoodReason,
} from "@/lib/food-reason-openai";

const ANALYSIS_SYSTEM_PROMPT = `
너는 강아지 사료 추천을 위한 분석 AI다.

사용자의 문장을 보고 아래 JSON 형식으로만 응답해라.

가능한 goal:

* diet (다이어트)
* muscle (근육 증가)
* normal (일반)

가능한 need:

* low_fat (저지방)
* high_protein (고단백)
* balanced (균형)

type:

* food
* snack

반드시 JSON만 반환하고 설명은 하지마.

예시:

입력: 우리 강아지 살 좀 빼야 돼
출력:
{
"goal": "diet",
"need": "low_fat",
"type": ["food"]
}

입력: 근육 키우고 싶어
출력:
{
"goal": "muscle",
"need": "high_protein",
"type": ["food"]
}
`.trim();

const FALLBACK_SYSTEM_PROMPT = `
너는 강아지 사료 추천 전문가다.

사용자의 상황을 보고 실제 존재하는 사료를 추천해라.

조건:

* 2~3개 추천
* 한국에서 구매 가능한 제품
* 간단한 이유 포함

반드시 아래 JSON 객체만 반환한다 (설명 금지):

{
  "recommendations": [
    { "name": "사료명", "reason": "추천 이유" }
  ]
}
`.trim();

export type AiDogAnalysis = {
  goal: string;
  need: string;
  type: string[];
};

export type FallbackRecommendation = {
  name: string;
  reason: string;
};

type OpenAIChatResponse = {
  error?: { message?: string };
  choices?: Array<{ message?: { content?: string | null } }>;
};

function normalizeAiParsed(parsed: unknown): AiDogAnalysis {
  const o =
    parsed !== null &&
    typeof parsed === "object" &&
    !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};

  const goal =
    typeof o.goal === "string" && o.goal.trim() !== ""
      ? o.goal.trim()
      : "normal";
  const need =
    typeof o.need === "string" && o.need.trim() !== ""
      ? o.need.trim()
      : "balanced";

  let type: string[] = ["food"];
  if (Array.isArray(o.type)) {
    const t = o.type.filter((x): x is string => typeof x === "string");
    if (t.length > 0) {
      type = t;
    }
  }

  return { goal, need, type };
}

function parseFallbackPayload(
  text: string
): { ok: true; items: FallbackRecommendation[] } | { ok: false } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { ok: false };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false };
  }

  let rawList: unknown;
  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else {
    const rec = (parsed as Record<string, unknown>).recommendations;
    rawList = rec;
  }

  if (!Array.isArray(rawList)) {
    return { ok: false };
  }

  const items: FallbackRecommendation[] = [];
  for (const entry of rawList) {
    if (
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as { name?: unknown }).name === "string" &&
      typeof (entry as { reason?: unknown }).reason === "string"
    ) {
      items.push({
        name: (entry as { name: string }).name.trim(),
        reason: (entry as { reason: string }).reason.trim(),
      });
    }
  }

  if (items.length === 0) {
    return { ok: false };
  }

  return { ok: true, items };
}

export type DbFoodWithReason = ScoredFood & { reason: string };

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

    if (
      typeof body !== "object" ||
      body === null ||
      typeof (body as { message?: unknown }).message !== "string"
    ) {
      return NextResponse.json(
        { error: "message 문자열이 필요합니다." },
        { status: 400 }
      );
    }

    const userMessage = (body as { message: string }).message.trim();
    if (!userMessage) {
      return NextResponse.json(
        { error: "message이 비어 있습니다." },
        { status: 400 }
      );
    }

    const openaiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
        }),
      }
    );

    const openaiData = (await openaiRes.json()) as OpenAIChatResponse;

    if (!openaiRes.ok) {
      const msg =
        openaiData.error?.message ?? `OpenAI API 오류 (${openaiRes.status})`;
      console.error("[ai-test] 분석 단계 API 오류", msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const analysisChoice = openaiData.choices?.[0];
    const raw = analysisChoice?.message?.content;
    if (analysisChoice == null) {
      console.error("[ai-test] 분석 choices[0] 없음", openaiData);
      return NextResponse.json(
        { error: "OpenAI 응답에 choices 항목이 없습니다." },
        { status: 502 }
      );
    }
    if (typeof raw !== "string" || !raw.trim()) {
      console.error("[ai-test] 분석 content 비어 있음", { analysisChoice });
      return NextResponse.json(
        { error: "모델 응답이 비어 있습니다." },
        { status: 502 }
      );
    }

    let parsedAnalysis: unknown = {};
    try {
      parsedAnalysis = JSON.parse(raw) as unknown;
    } catch (e) {
      console.error(
        "[ai-test] 분석 JSON.parse 실패, goal/need 기본값 사용",
        e
      );
    }

    const aiJson = normalizeAiParsed(parsedAnalysis);
    console.log("[ai-test] 정규화된 분석:", aiJson);

    const dogProfile = extractDogProfile(body as Record<string, unknown>);

    const analyzeOnly =
      (body as { analyzeOnly?: unknown }).analyzeOnly === true;
    if (analyzeOnly) {
      console.log("[ai-test] analyzeOnly: 추천·이유 단계 생략");
      return NextResponse.json({ ai: aiJson });
    }

    const recommend = recommendFoods(aiJson);
    console.log("[ai-test] DB 추천 건수:", recommend.length);

    if (!recommend || recommend.length === 0) {
      console.log("[ai-test] DB 결과 없음 → AI fallback 시도");

      const fallbackRes = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: FALLBACK_SYSTEM_PROMPT },
              { role: "user", content: userMessage },
            ],
            response_format: { type: "json_object" },
            temperature: 0.5,
          }),
        }
      );

      const fallbackData = (await fallbackRes.json()) as OpenAIChatResponse;

      if (!fallbackRes.ok) {
        const msg =
          fallbackData.error?.message ??
          `Fallback OpenAI 오류 (${fallbackRes.status})`;
        console.error("[ai-test] fallback API 오류", msg);
        return NextResponse.json({ error: msg }, { status: 502 });
      }

      const fbChoice = fallbackData.choices?.[0];
      const fallbackText = fbChoice?.message?.content;
      if (fbChoice == null) {
        console.error("[ai-test] fallback choices[0] 없음", fallbackData);
        return NextResponse.json(
          { error: "Fallback 응답에 choices가 없습니다." },
          { status: 502 }
        );
      }
      if (typeof fallbackText !== "string" || !fallbackText.trim()) {
        console.error("[ai-test] fallback content 비어 있음", { fbChoice });
        return NextResponse.json(
          { error: "Fallback 모델 응답이 비어 있습니다." },
          { status: 502 }
        );
      }

      const parsedFb = parseFallbackPayload(fallbackText.trim());
      if (!parsedFb.ok) {
        console.error(
          "[ai-test] fallback JSON 파싱/스키마 실패",
          fallbackText.slice(0, 500)
        );
        return NextResponse.json(
          {
            error: "Fallback JSON 파싱 실패",
            raw: fallbackText,
          },
          { status: 502 }
        );
      }

      console.log("[ai-test] fallback 추천 건수:", parsedFb.items.length);

      return NextResponse.json({
        source: "ai",
        ai: aiJson,
        data: parsedFb.items,
      });
    }

    const dataOut: DbFoodWithReason[] = [];
    for (const f of recommend) {
      const rounded: ScoredFood = { ...f, score: Math.round(f.score) };
      const reason = await generateFoodReason(
        rounded,
        aiJson,
        apiKey,
        dogProfile
      );
      dataOut.push({ ...rounded, reason });
    }

    console.log("[ai-test] DB 추천 이유 생성 완료:", dataOut.length, "건");

    return NextResponse.json({
      source: "db",
      ai: aiJson,
      data: dataOut,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[ai-test] 예외", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
