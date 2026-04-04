/**
 * 서버 전용 Google Cloud Vision — DOCUMENT_TEXT_DETECTION
 * API 키는 환경변수에만 두고 클라이언트에 노출하지 않습니다.
 */

export type VisionAnnotateResult = {
  text: string;
  raw: unknown;
};

export async function runDocumentTextDetection(
  imageBuffer: Buffer,
  apiKey: string
): Promise<VisionAnnotateResult> {
  const key = apiKey.trim();
  if (key === "") {
    return { text: "", raw: null };
  }

  const base64 = imageBuffer.toString("base64");
  const url =
    "https://vision.googleapis.com/v1/images:annotate?key=" +
    encodeURIComponent(key);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: base64 },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        },
      ],
    }),
  });

  const raw: unknown = await res.json();

  if (!res.ok) {
    const msg =
      typeof raw === "object" &&
      raw !== null &&
      "error" in raw &&
      typeof (raw as { error?: { message?: string } }).error === "object" &&
      (raw as { error?: { message?: string } }).error &&
      typeof (raw as { error: { message?: string } }).error.message === "string"
        ? (raw as { error: { message: string } }).error.message
        : JSON.stringify(raw);
    throw new Error("Vision API " + String(res.status) + ": " + msg);
  }

  if (typeof raw !== "object" || raw === null) {
    return { text: "", raw };
  }

  const responses = (raw as { responses?: unknown }).responses;
  if (!Array.isArray(responses) || responses.length === 0) {
    return { text: "", raw };
  }

  const first = responses[0];
  if (!first || typeof first !== "object") {
    return { text: "", raw };
  }

  const fta = (first as { fullTextAnnotation?: { text?: string } })
    .fullTextAnnotation;
  const text =
    fta && typeof fta.text === "string" ? fta.text : "";

  return { text, raw };
}
