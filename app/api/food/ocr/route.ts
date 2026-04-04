import { NextResponse } from "next/server";
import { parseOcrTextToDraft } from "@/lib/ocr-parse";
import { runDocumentTextDetection } from "@/lib/google-vision-ocr-server";
import {
  getFullTextAnnotationFromAnnotateResponse,
  processBlockBasedVisionOCR,
} from "@/lib/vision-block-ingredient-parser";
import { runOcrPetFoodPipeline } from "@/lib/ocr-pet-food-pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

async function runTesseract(buf: Buffer): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("kor+eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(buf);
    return text ?? "";
  } finally {
    await worker.terminate();
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("image") ?? form.get("file");
    console.log("[food/ocr] 요청 FormData 키:", [...form.keys()]);
    if (file instanceof Blob) {
      const label = file instanceof File ? file.name : "(Blob)";
      console.log("[food/ocr] 업로드:", label, "size(bytes):", file.size);
    } else if (file != null) {
      console.log("[food/ocr] file 필드 타입:", typeof file);
    }
    if (!(file instanceof Blob)) {
      return NextResponse.json(
        {
          success: false,
          error: "image 또는 file 필드에 이미지를 넣어 주세요.",
        },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    console.log("[food/ocr] 이미지 버퍼 byteLength:", buf.length);
    if (buf.length < 64) {
      return NextResponse.json(
        { success: false, error: "이미지가 너무 작습니다." },
        { status: 400 }
      );
    }

    const visionKeyRaw =
      typeof process.env.GOOGLE_VISION_API_KEY === "string" &&
      process.env.GOOGLE_VISION_API_KEY.trim() !== ""
        ? process.env.GOOGLE_VISION_API_KEY
        : typeof process.env.API_KEY === "string"
          ? process.env.API_KEY
          : "";
    const visionKey = visionKeyRaw.trim();

    let ocrText = "";
    let ocrEngine: "google-vision" | "tesseract" = "tesseract";
    let visionBlockBased = false;
    let visionRawBlocks: string[] = [];
    let visionIngredientBlock = "";
    let visionIngredients: string[] = [];

    if (visionKey !== "") {
      try {
        const { text, raw } = await runDocumentTextDetection(buf, visionKey);
        const fta = getFullTextAnnotationFromAnnotateResponse(raw);
        const blockBased = processBlockBasedVisionOCR(fta);

        if (blockBased.rawBlocks.length > 0) {
          visionBlockBased = true;
          visionRawBlocks = blockBased.rawBlocks;
          visionIngredientBlock = blockBased.ingredientBlock;
          visionIngredients = blockBased.ingredients;
          ocrText = visionRawBlocks.join(" ");
          ocrEngine = "google-vision";
          console.log(
            "[food/ocr] Vision 블록 기반 OCR, blocks:",
            visionRawBlocks.length,
            "joined length:",
            ocrText.length
          );
        } else if (text.trim() !== "") {
          ocrText = text;
          ocrEngine = "google-vision";
          console.log(
            "[food/ocr] Vision fullText (블록 비어 있음) length:",
            ocrText.length
          );
        } else {
          console.warn(
            "[food/ocr] Vision 응답에 블록·텍스트 없음 → Tesseract 폴백"
          );
        }
      } catch (err) {
        console.error("[food/ocr] Vision 실패, Tesseract 폴백:", err);
      }
    } else {
      console.log(
        "[food/ocr] GOOGLE_VISION_API_KEY 없음 → Tesseract만 사용 (.env.local에 키 설정 가능)"
      );
    }

    if (ocrText.trim() === "") {
      ocrText = await runTesseract(buf);
      ocrEngine = "tesseract";
      visionBlockBased = false;
      visionRawBlocks = [];
      visionIngredientBlock = "";
      visionIngredients = [];
      console.log("[food/ocr] Tesseract OCR length:", ocrText.length);
    }

    console.log("[food/ocr] ===== OCR 원본 (가공 전) =====");
    console.log("[food/ocr] ocrEngine:", ocrEngine);
    console.log("[food/ocr] visionBlockBased:", visionBlockBased);
    console.log("[food/ocr] ocrText.length:", ocrText.length);
    console.log("[food/ocr] ocrText 전체:\n", ocrText);

    const parsed = parseOcrTextToDraft(ocrText);
    console.log("[food/ocr] ----- 파싱 JSON -----");
    console.log(JSON.stringify(parsed, null, 2));

    const structuredProduct = await runOcrPetFoodPipeline(
      ocrText,
      visionIngredientBlock
    );

    return NextResponse.json({
      success: true,
      ocrText,
      ocrEngine,
      visionBlockBased,
      visionRawBlocks,
      visionIngredientBlock,
      visionIngredients,
      structuredProduct,
      parsed,
    });
  } catch (e) {
    console.error("[food/ocr] 오류", e);
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "OCR 처리 실패",
      },
      { status: 500 }
    );
  }
}
