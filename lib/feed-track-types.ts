export type ScannedFoodPayload = {
  foodName: string;
  kcal: number;
  recommendedAmount: number;
};

export type FeedPeriod = "morning" | "evening";

export type FeedReaction = "good" | "ok" | "bad";

export type FeedTrackPrefs = {
  period: FeedPeriod;
  amountG: number;
  reaction: FeedReaction;
  /** 직접입력 사용 시 마지막 값 */
  customG: number | null;
};

export const FEED_SCAN_SESSION_KEY = "dogRecom:feedScanPayload";

export const FEED_DONE_SESSION_KEY = "dogRecom:feedDoneSummary";

export const FEED_PREFS_STORAGE_KEY = "dogRecom:feedTrackPrefs";

export const MOCK_SCANNED_FOOD: ScannedFoodPayload = {
  foodName: "닥터독 저지방 다이어트",
  kcal: 320,
  recommendedAmount: 100,
};
