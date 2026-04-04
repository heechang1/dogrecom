/** 활동량 UI 값 → 계수 (LOW / NORMAL / HIGH) */
const ACTIVITY_FACTOR: Record<string, number> = {
  낮음: 1.2,
  보통: 1.6,
  높음: 2.0,
};

export function getActivityMultiplier(activityLabel: string): number {
  const factor = ACTIVITY_FACTOR[activityLabel];
  if (typeof factor === "number") {
    return factor;
  }
  return ACTIVITY_FACTOR["보통"];
}

export function computeSimulation(
  weightKg: number,
  activityLabel: string,
  snackKcalPerServing: number
) {
  const rer = 70 * Math.pow(weightKg, 0.75);
  const activityMultiplier = getActivityMultiplier(activityLabel);
  const mer = rer * activityMultiplier;
  const snackTotal = snackKcalPerServing * 2;
  const surplus = snackTotal;
  const weightChange30d = (surplus * 30) / 7700;

  return {
    rer,
    mer,
    snackTotal,
    surplus,
    weightChange30d,
    activityMultiplier,
  };
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function formatWeightChangeHeadline(
  surplus: number,
  weightChange30d: number
): string {
  const absVal = round1(Math.abs(weightChange30d));
  if (surplus > 0) {
    return "+" + absVal + "kg 증가 예상 (30일 기준)";
  }
  if (surplus < 0) {
    return "-" + absVal + "kg 감소 예상 (30일 기준)";
  }
  return "0kg 변화 (30일 기준)";
}

function getStatusMessage(surplus: number): string {
  if (surplus > 0) {
    return "체중 증가 위험이 있어요";
  }
  if (surplus === 0) {
    return "현재 상태 유지 가능";
  }
  return "체중 감소 가능";
}

export type SimulationResult = {
  weightChange: number;
  status: "gain" | "loss" | "maintain";
  message: string;
  rer: number;
  mer: number;
  surplus: number;
};

export function runSimulate(
  weightKg: number,
  activityLabel: string,
  snackKcal: number
): SimulationResult | null {
  const m = computeSimulation(weightKg, activityLabel, snackKcal);
  const surplus = m.surplus;
  let status: SimulationResult["status"] = "maintain";
  if (surplus > 0) {
    status = "gain";
  } else if (surplus < 0) {
    status = "loss";
  }
  return {
    weightChange: m.weightChange30d,
    status,
    message: getStatusMessage(surplus),
    rer: m.rer,
    mer: m.mer,
    surplus,
  };
}

export function parseWeightKg(weightStr: string): number | null {
  if (weightStr === "" || weightStr === null || weightStr === undefined) {
    return null;
  }
  const n = parseFloat(weightStr);
  if (isNaN(n) || n <= 0) {
    return null;
  }
  return n;
}
