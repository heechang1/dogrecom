import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const FEEDBACK_FILE = path.join(DATA_DIR, "food-feedback.json");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readFoodFeedbackAdjustments(): Record<string, number> {
  try {
    if (!fs.existsSync(FEEDBACK_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(FEEDBACK_FILE, "utf8");
    const data = JSON.parse(raw) as unknown;
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return {};
    }
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) {
        out[k] = v;
      }
    }
    return out;
  } catch (e) {
    console.error("[food-feedback-store] read 실패", e);
    return {};
  }
}

export function applyFoodFeedback(
  foodId: string,
  feedback: "like" | "dislike"
): void {
  const delta = feedback === "like" ? 5 : -5;
  const map = readFoodFeedbackAdjustments();
  const key = String(foodId);
  map[key] = (map[key] ?? 0) + delta;
  try {
    ensureDataDir();
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(map, null, 2), "utf8");
  } catch (e) {
    console.error("[food-feedback-store] write 실패", e);
    throw e;
  }
}
