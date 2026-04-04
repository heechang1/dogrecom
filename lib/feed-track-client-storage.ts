import type {
  FeedTrackPrefs,
  ScannedFoodPayload,
} from "@/lib/feed-track-types";
import {
  FEED_DONE_SESSION_KEY,
  FEED_PREFS_STORAGE_KEY,
  FEED_SCAN_SESSION_KEY,
} from "@/lib/feed-track-types";

export type FeedDoneSummary = {
  foodName: string;
  amountG: number;
  todayTotalG: number;
};

export function saveScanPayload(payload: ScannedFoodPayload): void {
  try {
    sessionStorage.setItem(FEED_SCAN_SESSION_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function readScanPayload(): ScannedFoodPayload | null {
  try {
    const raw = sessionStorage.getItem(FEED_SCAN_SESSION_KEY);
    if (!raw) {
      return null;
    }
    const o = JSON.parse(raw) as unknown;
    if (
      typeof o === "object" &&
      o !== null &&
      typeof (o as ScannedFoodPayload).foodName === "string" &&
      typeof (o as ScannedFoodPayload).kcal === "number" &&
      typeof (o as ScannedFoodPayload).recommendedAmount === "number"
    ) {
      return o as ScannedFoodPayload;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function clearScanPayload(): void {
  try {
    sessionStorage.removeItem(FEED_SCAN_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function saveDoneSummary(summary: FeedDoneSummary): void {
  try {
    sessionStorage.setItem(FEED_DONE_SESSION_KEY, JSON.stringify(summary));
  } catch {
    /* ignore */
  }
}

export function readDoneSummary(): FeedDoneSummary | null {
  try {
    const raw = sessionStorage.getItem(FEED_DONE_SESSION_KEY);
    if (!raw) {
      return null;
    }
    const o = JSON.parse(raw) as unknown;
    if (
      typeof o === "object" &&
      o !== null &&
      typeof (o as FeedDoneSummary).foodName === "string" &&
      typeof (o as FeedDoneSummary).amountG === "number" &&
      typeof (o as FeedDoneSummary).todayTotalG === "number"
    ) {
      return o as FeedDoneSummary;
    }
  } catch {
    /* ignore */
  }
  return null;
}

const defaultPrefs: FeedTrackPrefs = {
  period: "morning",
  amountG: 100,
  reaction: "good",
  customG: null,
};

export function readFeedTrackPrefs(): FeedTrackPrefs {
  try {
    const raw = localStorage.getItem(FEED_PREFS_STORAGE_KEY);
    if (!raw) {
      return { ...defaultPrefs };
    }
    const o = JSON.parse(raw) as unknown;
    if (typeof o !== "object" || o === null) {
      return { ...defaultPrefs };
    }
    const p = o as Partial<FeedTrackPrefs>;
    const period =
      p.period === "evening" || p.period === "morning"
        ? p.period
        : defaultPrefs.period;
    const amountG =
      typeof p.amountG === "number" && p.amountG > 0
        ? p.amountG
        : defaultPrefs.amountG;
    const reaction =
      p.reaction === "good" || p.reaction === "ok" || p.reaction === "bad"
        ? p.reaction
        : defaultPrefs.reaction;
    const customG =
      typeof p.customG === "number" && p.customG > 0 ? p.customG : null;
    return { period, amountG, reaction, customG };
  } catch {
    return { ...defaultPrefs };
  }
}

export function writeFeedTrackPrefs(prefs: FeedTrackPrefs): void {
  try {
    localStorage.setItem(FEED_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}
