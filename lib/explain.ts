export type ExplainFood = {
  name: string;
  protein: number;
  fat: number;
};

export type ExplainAI = {
  goal: string;
  need: string;
};

type OpenAIChatResponse = {
  error?: { message?: string };
  choices?: Array<{ message?: { content?: string | null } }>;
};

export async function generateExplanation(
  food: ExplainFood,
  ai: ExplainAI
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[explain] OPENAI_API_KEY 없음");
    return "";
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "사료 추천 이유를 한 줄로 설명",
          },
          {
            role: "user",
            content: `
이 사료 정보를 보고 추천 이유를 설명해줘.

사료명: ${food.name}
단백질: ${food.protein}
지방: ${food.fat}
목표: ${ai.goal}
조건: ${ai.need}
`,
          },
        ],
        temperature: 0.4,
      }),
    });

    const data = (await res.json()) as OpenAIChatResponse;

    if (!res.ok) {
      const msg = data.error?.message ?? `HTTP ${res.status}`;
      console.error("[explain] OpenAI API 오류", msg, data);
      return "";
    }

    const choice = data.choices?.[0];
    if (choice == null) {
      console.error("[explain] choices[0] 없음", data);
      return "";
    }

    const text = choice.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      console.error("[explain] 응답 content 비어 있음", { choice });
      return "";
    }

    console.log("[explain] 생성 완료:", food.name);
    return text.trim();
  } catch (e) {
    console.error("[explain] 요청 실패", food.name, e);
    return "";
  }
}
