import type { FoodParsedSnapshot } from "@/lib/food-record";

function toFloat(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    return Number.isFinite(v) ? v : null;
  }
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseFloat(v.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** % 성분: 0~100만 유지, 초과·음수는 null */
function clampPercent(v: unknown): number | null {
  const n = toFloat(v);
  if (n === null) return null;
  if (n < 0 || n > 100) return null;
  return n;
}

/** kcal: % 규칙 제외, 일반 사료 범위 */
function clampKcal(v: unknown): number | null {
  const n = toFloat(v);
  if (n === null) return null;
  if (n < 200 || n > 8000) return null;
  return n;
}

function cleanStringList(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    if (t.length === 0 || t.length > 80) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * OpenAI JSON → 후처리 (parseFloat, % 100 초과 제거, ingredients 최대 10)
 */
export function postProcessAiFoodJson(raw: unknown): FoodParsedSnapshot {
  const o =
    raw !== null && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const name = typeof o.name === "string" ? o.name.trim() : "";
  const brand =
    o.brand === null || o.brand === undefined
      ? null
      : typeof o.brand === "string"
        ? o.brand.trim() || null
        : null;

  const protein = clampPercent(o.protein);
  const fat = clampPercent(o.fat);
  const fiber = clampPercent(o.fiber);
  const kcal = clampKcal(o.kcal);

  const ingredients = cleanStringList(o.ingredients, 10);
  const tags = cleanStringList(o.tags, 20);
  const target = cleanStringList(o.target, 15);

  const feature =
    typeof o.feature === "string" ? o.feature.trim().slice(0, 500) : "";

  return {
    name,
    brand,
    protein,
    fat,
    fiber,
    kcal,
    ingredients,
    tags,
    feature,
    target,
  };
}

/** AI 후처리 결과가 추천 DB에 넣기에 충분한지 */
export function isParsedUsable(p: FoodParsedSnapshot): boolean {
  if (!p.name || p.name.trim().length === 0) return false;
  if (p.protein === null || p.fat === null || p.fiber === null) return false;
  if (p.ingredients.length === 0) return false;
  return true;
}
