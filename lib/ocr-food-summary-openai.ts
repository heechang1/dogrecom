type OpenAIChatResponse = {
  error?: { message?: string };
  choices?: Array<{ message?: { content?: string | null } }>;
};

export type PetFoodSummaryInput = {
  name: string;
  ingredients: string;
  /** e.g. "조단백 27%, 조지방 13%, …" — OCR에서 나온 값만 */
  nutritionText: string;
};

/**
 * 원재료·성분 수치는 입력으로만 전달하고, 요약 문장만 생성합니다.
 * API 키 없으면 빈 문자열.
 */
export async function generatePetFoodSummaryOpenAI(
  input: PetFoodSummaryInput
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return "";
  }

  const userPayload = [
    `제품명: ${input.name || "(없음)"}`,
    "",
    "원재료(블록):",
    input.ingredients.trim() || "(없음)",
    "",
    "영양 성분(OCR):",
    input.nutritionText.trim() || "(없음)",
  ].join("\n");

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
            content: `You are an AI assistant summarizing pet food in Korean.
Rules:
- Use ONLY facts implied by the given name, ingredients, and nutrition numbers. Do not invent ingredients or numbers.
- Mention a main protein source only if it clearly appears in the ingredients (e.g. 닭고기, 연어).
- Mention 특징 when supported by text or numbers: 고단백, 저지방, 기능성(관절 등).
- 1–2 short sentences. No bullet points.`,
          },
          {
            role: "user",
            content: userPayload,
          },
        ],
        temperature: 0.35,
        max_tokens: 200,
      }),
    });

    const data = (await res.json()) as OpenAIChatResponse;

    if (!res.ok) {
      console.error(
        "[ocr-food-summary] OpenAI 오류",
        data.error?.message ?? res.status
      );
      return "";
    }

    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      return "";
    }

    return text.trim();
  } catch (e) {
    console.error("[ocr-food-summary] 요청 실패", e);
    return "";
  }
}
