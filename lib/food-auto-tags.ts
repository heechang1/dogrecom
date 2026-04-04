/** OCR·본문 텍스트 기반 자동 태그 (요구 룰) */
export function applyRuleTags(text: string, existing: string[] = []): string[] {
  const T = text;
  const set = new Set(
    existing.map((t) => t.trim()).filter((t) => t.length > 0)
  );

  if (T.includes("저지방") || T.includes("다이어트")) {
    set.add("다이어트");
  }
  if (T.includes("유기농")) {
    set.add("유기농");
  }
  if (T.includes("관절") || T.includes("글루코사민")) {
    set.add("관절");
  }
  if (T.includes("피부")) {
    set.add("피부");
  }
  if (T.includes("눈물")) {
    set.add("저알러지");
  }

  return [...set];
}
