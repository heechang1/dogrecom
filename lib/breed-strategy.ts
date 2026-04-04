export type BreedStrategy = {
  size: string;
  activityLevel: string;
  obesityRisk: string;
  allergyRisk: string;
  recommendedProtein: string;
  recommendedFat: string;
};

const STRATEGY_KEYS = [
  "size",
  "activityLevel",
  "obesityRisk",
  "allergyRisk",
  "recommendedProtein",
  "recommendedFat",
] as const;

export function normalizeStrategy(raw: unknown): BreedStrategy {
  const empty: BreedStrategy = {
    size: "",
    activityLevel: "",
    obesityRisk: "",
    allergyRisk: "",
    recommendedProtein: "",
    recommendedFat: "",
  };
  if (typeof raw !== "object" || raw === null) {
    return empty;
  }
  const o = raw as Record<string, unknown>;
  const out = { ...empty };
  for (const k of STRATEGY_KEYS) {
    const v = o[k];
    if (typeof v === "string") {
      out[k] = v.trim();
    }
  }
  return out;
}

export function fallbackStrategyForBreed(breed: string): BreedStrategy {
  return {
    size: "소형~중형",
    activityLevel: "보통",
    obesityRisk: `${breed} 등 유사 체형은 비만 위험이 있는 편입니다`,
    allergyRisk: "개체마다 다름",
    recommendedProtein: "적정~다소 높게",
    recommendedFat: "저지방 권장",
  };
}

/** 전략 JSON을 recommendFoods용 goal/need에 반영 (기존 값 위에 덮어씀) */
export function applyStrategyToGoalNeed(
  strategy: BreedStrategy,
  goal: string,
  need: string
): { goal: string; need: string } {
  let g = goal;
  let n = need;
  const ob = `${strategy.obesityRisk}`.toLowerCase();
  const act = `${strategy.activityLevel}`.toLowerCase();
  const fatRec = `${strategy.recommendedFat}`.toLowerCase();
  const protRec = `${strategy.recommendedProtein}`.toLowerCase();

  const obesityHigh = /높|high|상|very|쉽게|주의/.test(ob);
  const activityHigh =
    /높|high|많|active/.test(act) ||
    `${strategy.activityLevel}`.includes("높음");

  if (obesityHigh) {
    g = "diet";
    n = "low_fat";
  } else {
    if (activityHigh && g !== "diet") {
      g = "muscle";
      n = "high_protein";
    }
    if (/저|low|낮|적게/.test(fatRec)) {
      n = "low_fat";
    }
    if (/고|high|높|많이/.test(protRec) && !obesityHigh) {
      n = "high_protein";
    }
  }

  return { goal: g, need: n };
}

export function buildBreedStrategySummary(
  breed: string,
  confidence: number,
  strategy: BreedStrategy | null
): { breedLine: string; strategyLine: string } {
  const pct = Math.round(Math.min(1, Math.max(0, confidence)) * 100);
  const breedLine = `${breed}으로 분석되었습니다 (신뢰도 ${pct}%).`;

  let strategyLine =
    "견종 특성에 맞춰 사료 필터·점수를 조정했습니다.";
  if (strategy) {
    const ob = strategy.obesityRisk;
    if (/높|상|high|쉽게|주의/.test(`${ob}`.toLowerCase())) {
      strategyLine =
        "이 견종은 비만 위험이 높아 저지방 사료 위주로 추천했습니다.";
    } else if (
      /높|많|high/.test(`${strategy.activityLevel}`.toLowerCase()) ||
      strategy.activityLevel.includes("높음")
    ) {
      strategyLine =
        "활동량이 많은 견종으로 보아 단백질 비중이 높은 사료를 우선했습니다.";
    } else if (strategy.allergyRisk && /높|주의/.test(strategy.allergyRisk)) {
      strategyLine =
        "알러지 위험을 고려해 성분을 확인하며 사료를 골랐습니다.";
    }
  }

  return { breedLine, strategyLine };
}
