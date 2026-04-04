import type { ScoredFood } from "@/lib/recommend";

export type FoodReasonAiContext = {
  goal: string;
  need: string;
};

/** 요청 본문에서 나이·체중 등 추출 (평탄 필드 또는 dogProfile 객체) */
export type DogProfileForReason = {
  age?: string;
  weight?: string;
  activity?: string;
  breed?: string;
};

export function extractDogProfile(
  body: Record<string, unknown>
): DogProfileForReason {
  const str = (v: unknown): string | undefined => {
    if (typeof v === "string") {
      const t = v.trim();
      return t !== "" ? t : undefined;
    }
    if (typeof v === "number" && Number.isFinite(v)) {
      return String(v);
    }
    return undefined;
  };

  const nested = body.dogProfile;
  if (
    typeof nested === "object" &&
    nested !== null &&
    !Array.isArray(nested)
  ) {
    const o = nested as Record<string, unknown>;
    return {
      age: str(o.age),
      weight: str(o.weight),
      activity: str(o.activity),
      breed: str(o.breed),
    };
  }

  return {
    age: str(body.age),
    weight: str(body.weight),
    activity: str(body.activity),
    breed: str(body.breed),
  };
}

function goalLabel(goal: string): string {
  switch (goal) {
    case "diet":
      return "다이어트";
    case "muscle":
      return "근육·체형";
    case "normal":
      return "일반 유지";
    default:
      return goal;
  }
}

function needLabel(need: string): string {
  switch (need) {
    case "low_fat":
      return "저지방";
    case "high_protein":
      return "고단백";
    case "balanced":
      return "영양 균형";
    default:
      return need;
  }
}

/** DB에 feature 필드가 없을 때 요약용 */
export function summarizeFoodFeature(food: ScoredFood): string {
  const cat = "category" in food ? food.category : undefined;
  const purposeKo =
    cat === "hypoallergenic"
      ? "저알러지·민감 반응 고려 배합"
      : food.purpose === "diet"
        ? "다이어트·체중 관리용 배합"
        : "일반 유지용 배합";
  const ing =
    Array.isArray(food.ingredients) && food.ingredients.length > 0
      ? `원료 예: ${food.ingredients.slice(0, 4).join(", ")}`
      : "";
  return ing ? `${purposeKo} · ${ing}` : purposeKo;
}

const REASON_SYSTEM_PROMPT = `
너는 반려견 맞춤 사료 추천 전문가다.

사용자가 입력한 강아지 정보와 사료 영양 정보를 바탕으로, 왜 이 사료가 이 아이에게 맞는지 2~3문장으로 설명한다.

규칙:
- 반드시 JSON 한 개만 반환한다. 설명 문장이나 마크다운 금지.
- 형식: {"reason":"..."}  이유만 reason 문자열에 넣는다.
- 쉬운 한국어, 전문 용어는 최소화.
- 숫자를 나열하듯 읽히지 않게, 상황과 연결해 자연스럽게 쓴다.
- 부드럽고 친절한 말투, 추천에 대한 자신감이 느껴지게.
`.trim();

function buildFoodReasonUserPrompt(
  food: ScoredFood,
  ai: FoodReasonAiContext,
  profile: DogProfileForReason
): string {
  const age = profile.age?.trim() ?? "";
  const weight = profile.weight?.trim() ?? "";
  const activity = profile.activity?.trim() ?? "";
  const breed = profile.breed?.trim() ?? "";

  const ageLine = age ? `${age}세` : "정보 없음";
  const weightLine = weight ? `${weight}kg` : "정보 없음";
  const activityLine = activity || "정보 없음";
  const breedSegment = breed ? `, 견종 ${breed}` : "";

  const goalKo = goalLabel(ai.goal);
  const needKo = needLabel(ai.need);
  const feature = summarizeFoodFeature(food);

  return `나이 ${ageLine}, 체중 ${weightLine}, 활동량 ${activityLine}${breedSegment}, 목표 ${goalKo}, 필요 영양 성향 ${needKo}인 강아지에게
"${food.name}" 사료가 왜 적합한지 설명해 주세요.

단백질 ${food.protein}%, 지방 ${food.fat}%.
사료 특징: ${feature}

위 수치는 참고용이며, 본문에서는 딱딱한 나열 대신 이 아이의 상황에 맞춘 자연스러운 문장으로 써 주세요.`;
}

export function parseReasonJson(text: string): string | null {
  const trimmed = text.trim();
  try {
    const o = JSON.parse(trimmed) as unknown;
    if (typeof o === "object" && o !== null) {
      const r = (o as Record<string, unknown>).reason;
      if (typeof r === "string" && r.trim() !== "") {
        return r.trim();
      }
    }
  } catch {
    const m = trimmed.match(/\{[\s\S]*"reason"[\s\S]*\}/);
    if (m) {
      try {
        const o = JSON.parse(m[0]) as { reason?: unknown };
        if (typeof o.reason === "string" && o.reason.trim() !== "") {
          return o.reason.trim();
        }
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

export async function generateFoodReason(
  food: ScoredFood,
  ai: FoodReasonAiContext,
  apiKey: string,
  profile: DogProfileForReason
): Promise<string> {
  const fallback = "추천 이유를 불러오지 못했습니다.";
  const userPrompt = buildFoodReasonUserPrompt(food, ai, profile);

  try {
    const reasonRes = await fetch(
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
            { role: "system", content: REASON_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.4,
        }),
      }
    );

    const reasonData = (await reasonRes.json()) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string | null } }>;
    };

    if (!reasonRes.ok) {
      console.error(
        "[food-reason] API 오류",
        food.name,
        reasonData.error?.message ?? reasonRes.status
      );
      return fallback;
    }

    const ch = reasonData.choices?.[0];
    const text = ch?.message?.content;
    if (ch == null) {
      console.error("[food-reason] choices 없음", food.name);
      return fallback;
    }
    if (typeof text !== "string" || !text.trim()) {
      console.error("[food-reason] content 비어 있음", food.name);
      return fallback;
    }

    const parsed = parseReasonJson(text);
    if (parsed) {
      return parsed;
    }

    console.error(
      "[food-reason] JSON 파싱 실패, 원문 일부:",
      text.slice(0, 200)
    );
    return fallback;
  } catch (e) {
    console.error("[food-reason] 요청 실패", food.name, e);
    return fallback;
  }
}
