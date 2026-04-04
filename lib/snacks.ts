export type Snack = {
  id: number;
  name: string;
  kcal: number;
  desc: string;
  reason: string;
  lowCal: boolean;
  category: string;
};

export const snackList: Snack[] = [
  {
    id: 1,
    name: "연어 저키",
    kcal: 38,
    desc: "오메가-3와 단백질을 함께 챙기기 좋아요.",
    reason: "오메가-3가 풍부해 피부·털 건강에 도움이 됩니다.",
    lowCal: false,
    category: "일반",
  },
  {
    id: 2,
    name: "닭가슴살 슬라이스",
    kcal: 25,
    desc: "저지방 고단백으로 칼로리 부담이 적은 편이에요.",
    reason: "고단백·저지방으로 활동량이 있는 아이에게 부담이 적습니다.",
    lowCal: true,
    category: "고단백",
  },
  {
    id: 3,
    name: "고구마 스틱",
    kcal: 18,
    desc: "천연 단맛과 식이섬유로 적은 양으로도 만족감을 줄여 줘요.",
    reason: "천연 탄수화물로 포만감을 주기 쉬워요.",
    lowCal: true,
    category: "일반",
  },
  {
    id: 4,
    name: "치아껌",
    kcal: 30,
    desc: "저작으로 치아 관리에 도움을 줄 수 있어요.",
    reason: "저작 활동을 유도해 구강 위생을 함께 챙길 수 있습니다.",
    lowCal: true,
    category: "일반",
  },
  {
    id: 5,
    name: "건조 칠면조 스트립",
    kcal: 28,
    desc: "닭고기 대체 단백으로 알러지 부담을 줄일 수 있어요.",
    reason: "단백질 보충에 적합한 저지방 간식입니다.",
    lowCal: true,
    category: "고단백",
  },
];

function shuffleCopy<T>(items: T[]): T[] {
  const arr = items.slice();
  let i = arr.length;
  while (i > 1) {
    i -= 1;
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function pickUpToThreeUnique(pool: Snack[], fullCatalog: Snack[]): Snack[] {
  const result: Snack[] = [];
  const usedIds: Record<number, boolean> = {};
  const shuffled = shuffleCopy(pool);
  let i = 0;
  while (result.length < 3 && i < shuffled.length) {
    const s = shuffled[i];
    i += 1;
    if (!usedIds[s.id]) {
      usedIds[s.id] = true;
      result.push(s);
    }
  }
  if (result.length < 3) {
    const rest = shuffleCopy(fullCatalog);
    let j = 0;
    while (result.length < 3 && j < rest.length) {
      const s = rest[j];
      j += 1;
      if (!usedIds[s.id]) {
        usedIds[s.id] = true;
        result.push(s);
      }
    }
  }
  return result;
}

export type UserInfo = {
  weight: string;
  activityLevel: string;
  dietNeeded: boolean;
};

export function getRecommended(list: Snack[], userInfo: UserInfo): Snack[] {
  const full = list.slice();
  const dietNeeded = userInfo.dietNeeded === true;
  const highActivity = userInfo.activityLevel === "높음";
  let pool = full.slice();

  if (dietNeeded) {
    pool = full.filter(function (s) {
      return s.lowCal === true;
    });
  } else if (highActivity) {
    pool = full.filter(function (s) {
      return s.category === "고단백";
    });
  }

  if (pool.length === 0) {
    pool = full.slice();
  }

  return pickUpToThreeUnique(pool, full);
}

export function pickLowerCalorieSnacks(
  currentKcal: number,
  catalog: Snack[] = snackList
): Snack[] {
  const lower = catalog.filter(function (item) {
    return item.kcal < currentKcal;
  });
  lower.sort(function (a, b) {
    return a.kcal - b.kcal;
  });
  return lower.slice(0, 3);
}
