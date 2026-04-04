import fs from "fs";
import path from "path";
import {
  type FoodDraft,
  type FoodParsedSnapshot,
  type FoodRecord,
  type FoodCategory,
  defaultPurposeFromCategory,
  estimateCarb,
} from "@/lib/food-record";

/** JSON 파일 저장 — SQL VARCHAR 제한 없음 (RDBMS 도입 시 raw_ocr/ feature 등은 TEXT/LONGTEXT 권장) */
const FOODS_PATH = path.join(process.cwd(), "data", "foods.json");

export function readFoodsFromDisk(): FoodRecord[] {
  try {
    const raw = fs.readFileSync(FOODS_PATH, "utf8");
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) {
      return [];
    }
    return data as FoodRecord[];
  } catch (e) {
    console.error("[foods-store] read 실패", e);
    return [];
  }
}

function inferCategoryFromParsed(p: FoodParsedSnapshot): FoodCategory {
  const t = `${p.feature} ${p.tags.join(" ")} ${p.target.join(" ")}`;
  if (
    p.tags.includes("다이어트") ||
    p.tags.includes("저지방") ||
    /다이어트|저지방|라이트|체중/i.test(t)
  ) {
    return "diet";
  }
  if (
    p.tags.includes("저알러지") ||
    /저알러지|하이포|단일\s*단백|가수분해/i.test(t)
  ) {
    return "hypoallergenic";
  }
  if (p.fat !== null && p.fat <= 10 && p.protein !== null && p.protein >= 22) {
    return "diet";
  }
  return "normal";
}

function writeFoodsToDisk(list: FoodRecord[]): void {
  const dir = path.dirname(FOODS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(FOODS_PATH, JSON.stringify(list, null, 2) + "\n", "utf8");
}

export function appendFoodDraft(draft: FoodDraft): FoodRecord {
  const list = readFoodsFromDisk();
  const maxId = list.reduce((m, f) => Math.max(m, f.id), 0);
  const nextId = maxId + 1;

  const protein = draft.protein ?? 26;
  const fat = draft.fat ?? 12;
  const fiber = draft.fiber ?? 4;
  const carb = estimateCarb(protein, fat, fiber);

  const record: FoodRecord = {
    id: nextId,
    name: draft.name.trim(),
    brand: draft.brand?.trim() || undefined,
    category: draft.category,
    protein,
    fat,
    carb,
    fiber,
    kcal: draft.kcal,
    ingredients:
      draft.ingredients.length > 0
        ? draft.ingredients
        : ["미상"],
    purpose: defaultPurposeFromCategory(draft.category),
    tags: draft.tags.length > 0 ? draft.tags : ["미분류"],
    feature: draft.feature.trim() || "OCR·사용자 입력 기록",
    target: draft.target.length > 0 ? draft.target : [],
  };

  list.push(record);
  writeFoodsToDisk(list);
  console.log("[foods-store] append 완료 id=", nextId, "name=", record.name);
  return record;
}

/**
 * AI 파이프라인 결과를 DB(foods.json)에 저장.
 * raw_ocr + parsed 스냅샷을 보관하고, 추천용 필드는 동일하게 평탄화.
 */
export function appendFoodFromAiParse(
  raw_ocr: string,
  parsed: FoodParsedSnapshot
): FoodRecord {
  const list = readFoodsFromDisk();
  const maxId = list.reduce((m, f) => Math.max(m, f.id), 0);
  const nextId = maxId + 1;

  const category = inferCategoryFromParsed(parsed);
  const protein = parsed.protein ?? 26;
  const fat = parsed.fat ?? 12;
  const fiber = parsed.fiber ?? 4;
  const carb = estimateCarb(protein, fat, fiber);

  const name =
    parsed.name.trim() ||
    (parsed.ingredients[0]?.trim() ?? "이름 미입력");

  const snapshot: FoodParsedSnapshot = { ...parsed };

  const record: FoodRecord = {
    id: nextId,
    raw_ocr,
    parsed: snapshot,
    name,
    brand: parsed.brand ?? undefined,
    category,
    protein,
    fat,
    carb,
    fiber: parsed.fiber ?? fiber,
    kcal: parsed.kcal,
    ingredients:
      parsed.ingredients.length > 0 ? parsed.ingredients : ["미상"],
    purpose: defaultPurposeFromCategory(category),
    tags: parsed.tags.length > 0 ? parsed.tags : ["미분류"],
    feature:
      parsed.feature.trim() ||
      "AI 정제 기록",
    target: parsed.target.length > 0 ? parsed.target : [],
  };

  list.push(record);
  writeFoodsToDisk(list);
  console.log(
    "[foods-store] AI append 완료 id=",
    nextId,
    "name=",
    record.name,
    "raw_ocr_len=",
    raw_ocr.length
  );
  return record;
}
