import { NextResponse } from "next/server";

type Body = {
  image?: string;
};

/**
 * 이미지 base64(선택)를 받되, 초기 구현은 mock 견종만 반환합니다.
 */
export async function POST(req: Request) {
  try {
    let body: Body = {};
    try {
      body = (await req.json()) as Body;
    } catch (e) {
      console.error("[analyze-breed] JSON 파싱 실패", e);
      return NextResponse.json(
        { error: "JSON 본문이 필요합니다." },
        { status: 400 }
      );
    }

    const hasImage =
      typeof body.image === "string" && body.image.trim().length > 0;
    console.log(
      "[analyze-breed] 요청 수신, 이미지 포함:",
      hasImage,
      hasImage ? `길이 ${body.image!.length}` : ""
    );

    // Mock: 실제 모델 연동 전까지 고정 응답 (이미지 길이로 살짝만 변주)
    const variant = hasImage ? body.image!.length % 3 : 0;
    const breeds = ["비숑", "푸들", "웰시코기"] as const;
    const breed = breeds[variant] ?? "비숑";
    const confidence = 0.75 + variant * 0.02;

    return NextResponse.json({
      breed,
      confidence,
    });
  } catch (e) {
    console.error("[analyze-breed] 예외", e);
    return NextResponse.json(
      { error: "서버 오류", breed: "믹스", confidence: 0.3 },
      { status: 500 }
    );
  }
}
