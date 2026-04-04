const JSON_SYSTEM_PROMPT = `너는 강아지 사료 성분 분석 전문가다.
출력은 반드시 하나의 완전한 JSON 객체뿐이다. 마크다운·코드펜스·설명 문장 금지.
JSON은 중간에 끊기지 않게 끝까지 작성한다.`;

function buildJsonUserPrompt(ocrText: string): string {
  return `입력된 텍스트는 OCR로 추출된 사료 라벨 정보이며,
오타, 줄바꿈 오류, 깨진 단어가 포함될 수 있다.

너의 역할:
- 텍스트를 정제한다
- 의미 단위로 파싱한다
- DB에 넣을 수 있는 JSON으로 변환한다

---

[출력 규칙 - 절대 중요]

1. 반드시 JSON만 출력 (설명 금지)
2. JSON은 절대 중간에 끊기면 안됨
3. 모든 필드는 반드시 채울 것 (없으면 null, 문자열 필드는 빈 문자열 "" 허용)
4. 숫자는 JSON number 타입만 (문자열로 숫자 넣지 말 것)
5. ingredients는 반드시 배열 형태
6. 중복 단어 제거
7. 의미 없는 단어 제거 (예: INDUSTRY, 무의미한 영어 조각, 라벨 쓰레기 텍스트)

---

[JSON 구조 - 이 키만 사용]

{
  "name": "",
  "brand": "",
  "protein": 0,
  "fat": 0,
  "fiber": 0,
  "kcal": 0,
  "ingredients": [],
  "tags": [],
  "feature": "",
  "target": []
}

- brand, protein, fat, fiber, kcal를 알 수 없으면 null (0으로 속이지 말 것. 단, 확실할 때만 숫자)
- kcal는 kcal/kg 대사에너지. 없으면 null.

---

[파싱 규칙]

- "조단백" "조단백질" "단백질" 뒤 % → protein
- "조지방" "지방" 뒤 % → fat
- "조섬유" "섬유" 뒤 % → fiber
- "kcal/kg" "kcal" "대사에너지" 등 → kcal (숫자만)

---

[태그 자동 분류]

- "저지방", "다이어트" → tags에 "다이어트"
- "관절", "글루코사민" → tags에 "관절"
- "유기농" → tags에 "유기농"
- "피부", "알러지" → tags에 "피부"
(중복 태그 넣지 말 것)

---

[원재료 ingredients 처리]

- 쉼표·줄바꿈 기준으로 분리해 배열로
- 괄호 () 내 부가설명 제거 후 핵심 명칭만
- % 및 숫자만 있는 토큰 제거
- 의미 없는 짧은 영어·기호 제거
- 한 글자·두 글자 무의미 토큰 제거
- 한국어 원료명 위주, 핵심 5~12개

---

[feature / target]

- feature: 제품 한 줄 요약 (한국어)
- target: 급여 대상·목적 예: ["다이어트", "노령견"] 없으면 []

---

[입력 텍스트]

${ocrText}`;
}

const CLEAN_SYSTEM_PROMPT = `너는 OCR 텍스트 정제 전문가다.
출력은 정제된 본문 텍스트 한 덩어리만. 설명·따옴표·JSON·불릿 금지.`;

function buildCleanUserPrompt(ocrText: string): string {
  return `입력된 텍스트는 사료 라벨에서 추출된 데이터이며,
다음 문제가 있다:
- 줄바꿈 깨짐
- 단어 분리 오류
- 의미 없는 텍스트 포함

[목표]

- 자연스러운 문장으로 복원
- 원재료 리스트를 하나의 문장으로 정리
- 숫자/단위 유지
- 의미 없는 단어 제거

[규칙]

1. 문장 끊김 없이 이어붙이기
2. "사용한 원료의 명칭" 및 원재료 관련 문구는 내용 유지
3. 불필요한 영어(상표·쓰레기 단어) 제거
4. 특수문자 정리

[출력 형식]

정제된 텍스트만 출력 (설명 금지)

---

[입력]

${ocrText}`;
}

type OpenAIChatResponse = {
  error?: { message?: string };
  choices?: Array<{ message?: { content?: string | null } }>;
};

/** gpt-4o-mini 출력 상한에 맞춤 — 응답 잘림 방지 */
const JSON_MAX_TOKENS = 16384;
const CLEAN_MAX_TOKENS = 16384;

/**
 * 1단계: 라벨 OCR → 자연어로만 정제 (설명 없이 본문만)
 */
export async function cleanOcrLabelTextWithAI(
  rawText: string,
  apiKey: string
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: CLEAN_SYSTEM_PROMPT },
        { role: "user", content: buildCleanUserPrompt(rawText) },
      ],
      temperature: 0.15,
      max_tokens: CLEAN_MAX_TOKENS,
    }),
  });

  const data = (await res.json()) as OpenAIChatResponse;

  if (!res.ok) {
    const msg = data.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== "string") {
    throw new Error("정제 응답이 비어 있습니다.");
  }

  const cleaned = text.trim();
  console.log("[food-parse/ai] cleanOcrLabelText.length:", cleaned.length);
  console.log("[food-parse/ai] cleanOcrLabelText 전체:\n", cleaned);
  return cleaned;
}

/**
 * 2단계: (선택 정제본 또는 원문) → 구조화 JSON
 */
export async function parseFoodWithAI(
  rawText: string,
  apiKey: string
): Promise<unknown> {
  const userContent = buildJsonUserPrompt(rawText);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: JSON_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.15,
      max_tokens: JSON_MAX_TOKENS,
    }),
  });

  const data = (await res.json()) as OpenAIChatResponse;

  if (!res.ok) {
    const msg = data.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("모델 응답이 비어 있습니다.");
  }

  console.log("[food-parse/ai] parseFoodWithAI 응답 content.length:", text.length);
  console.log("[food-parse/ai] parseFoodWithAI 응답 전체:\n", text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("모델 JSON 파싱 실패");
  }

  return parsed;
}
