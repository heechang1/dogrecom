import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const FEED_LOG_FILE = path.join(DATA_DIR, "feed-logs.json");

export type FeedLogEntry = {
  dogId: string;
  date: string;
  amount: number;
  foodName?: string;
  period?: "morning" | "evening";
  reaction?: "good" | "ok" | "bad";
  kcal?: number;
  recommendedAmount?: number;
};

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readLogs(): FeedLogEntry[] {
  try {
    if (!fs.existsSync(FEED_LOG_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(FEED_LOG_FILE, "utf8");
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) {
      return [];
    }
    const out: FeedLogEntry[] = [];
    for (const row of data) {
      if (
        typeof row === "object" &&
        row !== null &&
        typeof (row as FeedLogEntry).dogId === "string" &&
        typeof (row as FeedLogEntry).date === "string" &&
        typeof (row as FeedLogEntry).amount === "number"
      ) {
        const e = row as FeedLogEntry;
        out.push({
          dogId: e.dogId,
          date: e.date,
          amount: e.amount,
          foodName: typeof e.foodName === "string" ? e.foodName : undefined,
          period:
            e.period === "morning" || e.period === "evening"
              ? e.period
              : undefined,
          reaction:
            e.reaction === "good" || e.reaction === "ok" || e.reaction === "bad"
              ? e.reaction
              : undefined,
          kcal: typeof e.kcal === "number" ? e.kcal : undefined,
          recommendedAmount:
            typeof e.recommendedAmount === "number"
              ? e.recommendedAmount
              : undefined,
        });
      }
    }
    return out;
  } catch (e) {
    console.error("[feed-log-store] read 실패", e);
    return [];
  }
}

function todayLocalYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getTodayFeedTotalGrams(dogId: string): number {
  const today = todayLocalYmd();
  const id = String(dogId);
  return readLogs()
    .filter((e) => e.dogId === id && e.date === today)
    .reduce((sum, e) => sum + e.amount, 0);
}

export type AppendFeedLogOptions = {
  foodName?: string;
  period?: "morning" | "evening";
  reaction?: "good" | "ok" | "bad";
  kcal?: number;
  recommendedAmount?: number;
};

export function appendFeedLog(
  dogId: string,
  amount: number,
  extra?: AppendFeedLogOptions
): FeedLogEntry {
  const entry: FeedLogEntry = {
    dogId: String(dogId),
    date: todayLocalYmd(),
    amount,
    ...(extra?.foodName !== undefined ? { foodName: extra.foodName } : {}),
    ...(extra?.period !== undefined ? { period: extra.period } : {}),
    ...(extra?.reaction !== undefined ? { reaction: extra.reaction } : {}),
    ...(extra?.kcal !== undefined ? { kcal: extra.kcal } : {}),
    ...(extra?.recommendedAmount !== undefined
      ? { recommendedAmount: extra.recommendedAmount }
      : {}),
  };
  const logs = readLogs();
  logs.push(entry);
  try {
    ensureDataDir();
    fs.writeFileSync(FEED_LOG_FILE, JSON.stringify(logs, null, 2), "utf8");
  } catch (e) {
    console.error("[feed-log-store] write 실패", e);
    throw e;
  }
  return entry;
}
