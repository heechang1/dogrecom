"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AUTH_LEGACY_KEY,
  AUTH_STORAGE_KEY,
  PASSWORD,
} from "@/lib/auth-constants";
import {
  getRecommended,
  pickLowerCalorieSnacks,
  snackList,
  type Snack,
} from "@/lib/snacks";
import { recommendFoods, type ScoredFood } from "@/lib/recommend";
import {
  applyStrategyToGoalNeed,
  buildBreedStrategySummary,
  normalizeStrategy,
  type BreedStrategy,
} from "@/lib/breed-strategy";
import {
  blobUrlToBase64Payload,
  fileToBase64Payload,
} from "@/lib/read-image-base64";
import { parseWeightKg, runSimulate, type SimulationResult } from "@/lib/simulation";

export type ScoredFoodWithReason = ScoredFood & { reason?: string };

async function attachFoodReasons(
  foods: ScoredFood[],
  goal: string,
  need: string,
  profile: { age: string; weight: string; activity: string; breed: string }
): Promise<ScoredFoodWithReason[]> {
  if (foods.length === 0) return foods;
  try {
    const res = await fetch("/api/food-reasons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        foods,
        goal,
        need,
        age: profile.age,
        weight: profile.weight,
        activity: profile.activity,
        breed: profile.breed,
      }),
    });
    const data: unknown = await res.json();
    if (!res.ok) {
      console.error("[flow] food-reasons 실패", data);
      return foods;
    }
    if (
      typeof data === "object" &&
      data !== null &&
      Array.isArray((data as { data?: unknown }).data)
    ) {
      return (data as { data: ScoredFoodWithReason[] }).data;
    }
    return foods;
  } catch (e) {
    console.error("[flow] food-reasons 요청 오류", e);
    return foods;
  }
}

export type FlowBreedInsight = {
  breed: string;
  confidence: number;
  strategy: BreedStrategy | null;
  breedLine: string;
  strategyLine: string;
};

export type DogAppContextValue = {
  isAuthenticated: boolean;
  authReady: boolean;
  photoPreview: string | null;
  photoName: string;
  age: string;
  weight: string;
  activity: string;
  dietNeeded: boolean;
  /** 자유 텍스트 (AI goal/need 해석용) */
  prompt: string;
  recommendGoal: string;
  recommendNeed: string;
  recommendedFoods: ScoredFoodWithReason[];
  /** 사진 기반 견종·전략 요약 (추천 화면 표시) */
  flowBreedInsight: FlowBreedInsight | null;
  recommendedList: Snack[];
  selectedSnack: Snack | null;
  simulationResult: SimulationResult | null;
  alternatives: Snack[];
  basisOpenDetail: boolean;
  login: (password: string, remember: boolean) => boolean;
  logout: () => void;
  setPhotoFromFile: (file: File) => void;
  goToPhoto: () => void;
  goToInput: () => void;
  goToRecommend: () => Promise<void>;
  setAge: (v: string) => void;
  setWeight: (v: string) => void;
  setActivity: (v: string) => void;
  setDietNeeded: (v: boolean) => void;
  setPrompt: (v: string) => void;
  setInputFlowPhoto: (file: File | null) => void;
  syncRecommendFromSearchParams: (goal: string, need: string) => Promise<void>;
  /** 확정/수정된 견종으로 전략·사료 추천만 다시 계산 (간식 목록은 유지) */
  refreshRecommendationFromBreed: (
    breed: string,
    mode?: "default" | "same" | "edited"
  ) => Promise<void>;
  selectSnack: (snack: Snack) => void;
  showAlternative: () => void;
  selectAlternative: (snack: Snack) => void;
  flowBack: () => void;
  toggleBasisDetail: () => void;
  triggerPickPhoto: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
};

const DogAppContext = createContext<DogAppContextValue | null>(null);

export function useDogApp(): DogAppContextValue {
  const ctx = useContext(DogAppContext);
  if (!ctx) {
    throw new Error("useDogApp must be used within DogAppProvider");
  }
  return ctx;
}

export function DogAppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [authReady, setAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState("보통");
  const [dietNeeded, setDietNeeded] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [recommendGoal, setRecommendGoal] = useState("normal");
  const [recommendNeed, setRecommendNeed] = useState("balanced");
  const [recommendedFoods, setRecommendedFoods] = useState<
    ScoredFoodWithReason[]
  >([]);
  const [flowBreedInsight, setFlowBreedInsight] =
    useState<FlowBreedInsight | null>(null);
  const [inputFlowPhoto, setInputFlowPhoto] = useState<File | null>(null);
  const [recommendedList, setRecommendedList] = useState<Snack[]>([]);
  const [selectedSnack, setSelectedSnack] = useState<Snack | null>(null);
  const [simulationResult, setSimulationResult] =
    useState<SimulationResult | null>(null);
  const [alternatives, setAlternatives] = useState<Snack[]>([]);
  const [basisOpenDetail, setBasisOpenDetail] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const selectedSnackRef = useRef<Snack | null>(null);
  selectedSnackRef.current = selectedSnack;

  useEffect(() => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(AUTH_LEGACY_KEY);
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored === "true") {
          setIsAuthenticated(true);
        }
      }
    } catch {
      // ignore
    }
    setAuthReady(true);
  }, []);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!isAuthenticated && pathname.startsWith("/flow")) {
      router.replace("/login");
    }
  }, [authReady, isAuthenticated, pathname, router]);

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    if (pathname === "/login") {
      router.replace("/flow/photo");
    }
  }, [authReady, isAuthenticated, pathname, router]);

  const login = useCallback((password: string, remember: boolean): boolean => {
    if (password !== PASSWORD) {
      return false;
    }
    try {
      if (typeof localStorage !== "undefined") {
        if (remember) {
          localStorage.setItem(AUTH_STORAGE_KEY, "true");
        } else {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      }
    } catch {
      // 저장 실패 시에도 화면 진입은 허용
    }
    setIsAuthenticated(true);
    router.push("/flow/photo");
    return true;
  }, [router]);

  const logout = useCallback(() => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem(AUTH_LEGACY_KEY);
      }
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
    setPhotoPreview(null);
    setPhotoName("");
    setAge("");
    setWeight("");
    setActivity("보통");
    setDietNeeded(false);
    setPrompt("");
    setRecommendGoal("normal");
    setRecommendNeed("balanced");
    setRecommendedFoods([]);
    setFlowBreedInsight(null);
    setInputFlowPhoto(null);
    setRecommendedList([]);
    setSelectedSnack(null);
    setSimulationResult(null);
    setAlternatives([]);
    setBasisOpenDetail(false);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    router.push("/login");
  }, [router]);

  const setPhotoFromFile = useCallback((file: File) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPhotoPreview(url);
    setPhotoName(file.name);
  }, []);

  const goToPhoto = useCallback(() => {
    setSelectedSnack(null);
    setSimulationResult(null);
    setAlternatives([]);
    setRecommendedList([]);
    setRecommendedFoods([]);
    setRecommendGoal("normal");
    setRecommendNeed("balanced");
    setFlowBreedInsight(null);
    setInputFlowPhoto(null);
    setBasisOpenDetail(false);
    router.push("/flow/photo");
  }, [router]);

  const goToInput = useCallback(() => {
    setSelectedSnack(null);
    setSimulationResult(null);
    setAlternatives([]);
    setRecommendedList([]);
    setRecommendedFoods([]);
    setRecommendGoal("normal");
    setRecommendNeed("balanced");
    setFlowBreedInsight(null);
    setInputFlowPhoto(null);
    setBasisOpenDetail(false);
    router.push("/flow/input");
  }, [router]);

  const syncRecommendFromSearchParams = useCallback(
    async (goal: string, need: string) => {
      const g = goal.trim() || "normal";
      const n = need.trim() || "balanced";
      setRecommendGoal(g);
      setRecommendNeed(n);
      const foods = recommendFoods({ goal: g, need: n, type: ["food"] });
      const breedHint = flowBreedInsight?.breed?.trim() ?? "";
      const withReasons = await attachFoodReasons(foods, g, n, {
        age,
        weight,
        activity,
        breed: breedHint,
      });
      setRecommendedFoods(withReasons);
    },
    [age, weight, activity, flowBreedInsight?.breed]
  );

  const goToRecommend = useCallback(async () => {
    setFlowBreedInsight(null);

    const defaultGoal = dietNeeded ? "diet" : "normal";
    const defaultNeed = dietNeeded ? "low_fat" : "balanced";
    let goal = defaultGoal;
    let need = defaultNeed;

    let imageBase64: string | null = null;
    try {
      if (inputFlowPhoto) {
        imageBase64 = await fileToBase64Payload(inputFlowPhoto);
        console.log("[flow] 입력 단계 사진으로 견종 분석 시도");
      } else if (photoPreview?.startsWith("blob:")) {
        imageBase64 = await blobUrlToBase64Payload(photoPreview);
        console.log("[flow] 1단계 미리보기 사진으로 견종 분석 시도");
      }
    } catch (e) {
      console.error("[flow] 이미지 base64 변환 실패", e);
      imageBase64 = null;
    }

    let breed: string | null = null;
    let confidence = 0.8;
    let strategy: BreedStrategy | null = null;

    if (imageBase64) {
      try {
        const breedRes = await fetch("/api/analyze-breed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: imageBase64 }),
        });
        const breedData: unknown = await breedRes.json();
        if (
          breedRes.ok &&
          typeof breedData === "object" &&
          breedData !== null &&
          typeof (breedData as { breed?: unknown }).breed === "string"
        ) {
          breed = (breedData as { breed: string }).breed.trim();
          const c = (breedData as { confidence?: unknown }).confidence;
          if (typeof c === "number" && Number.isFinite(c)) {
            confidence = c;
          }
          console.log("[flow] 견종 분석 결과:", breed, confidence);
        } else {
          console.error("[flow] analyze-breed 실패", breedData);
        }
      } catch (e) {
        console.error("[flow] analyze-breed 요청 오류", e);
      }

      if (breed) {
        try {
          const strategyRes = await fetch("/api/generate-strategy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ breed }),
          });
          const strategyData: unknown = await strategyRes.json();
          if (
            strategyRes.ok &&
            typeof strategyData === "object" &&
            strategyData !== null &&
            !("error" in strategyData && strategyData.error)
          ) {
            strategy = normalizeStrategy(strategyData);
            const adj = applyStrategyToGoalNeed(strategy, goal, need);
            goal = adj.goal;
            need = adj.need;
            console.log("[flow] 전략 반영 후 goal/need:", goal, need, strategy);
          } else {
            console.error("[flow] generate-strategy 실패", strategyData);
          }
        } catch (e) {
          console.error("[flow] generate-strategy 요청 오류", e);
        }

        const lines = buildBreedStrategySummary(
          breed,
          confidence,
          strategy
        );
        setFlowBreedInsight({
          breed,
          confidence,
          strategy,
          breedLine: lines.breedLine,
          strategyLine: lines.strategyLine,
        });
      }
    }

    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt) {
      try {
        const res = await fetch("/api/ai-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmedPrompt,
            analyzeOnly: true,
          }),
        });
        const data: unknown = await res.json();
        if (res.ok && typeof data === "object" && data !== null) {
          const ai = (data as { ai?: unknown }).ai;
          if (typeof ai === "object" && ai !== null) {
            const a = ai as Record<string, unknown>;
            if (typeof a.goal === "string" && a.goal.trim() !== "") {
              goal = a.goal.trim();
            }
            if (typeof a.need === "string" && a.need.trim() !== "") {
              need = a.need.trim();
            }
          }
        } else {
          console.error("[flow] AI 텍스트 분석 실패, goal/need 유지", data);
        }
      } catch (e) {
        console.error("[flow] AI 텍스트 분석 요청 오류", e);
      }
    }

    const userInfo = {
      weight,
      activityLevel: activity,
      dietNeeded,
    };
    const recommended = getRecommended(snackList, userInfo);
    setRecommendedList(recommended);

    const foods = recommendFoods({ goal, need, type: ["food"] });
    const foodsWithReasons = await attachFoodReasons(foods, goal, need, {
      age,
      weight,
      activity,
      breed: breed ?? "",
    });
    setRecommendedFoods(foodsWithReasons);
    setRecommendGoal(goal);
    setRecommendNeed(need);

    setSelectedSnack(null);
    setSimulationResult(null);
    setAlternatives([]);
    setBasisOpenDetail(false);

    const q = new URLSearchParams({ goal, need });
    router.push(`/flow/recommend?${q.toString()}`);
  }, [
    age,
    weight,
    activity,
    dietNeeded,
    prompt,
    router,
    inputFlowPhoto,
    photoPreview,
  ]);

  const refreshRecommendationFromBreed = useCallback(
    async (breed: string, mode: "default" | "same" | "edited" = "default") => {
      const trimmed = breed.trim();
      if (!trimmed) {
        console.warn("[flow] refreshRecommendationFromBreed: 빈 견종");
        return;
      }

      const defaultGoal = dietNeeded ? "diet" : "normal";
      const defaultNeed = dietNeeded ? "low_fat" : "balanced";
      let goal = defaultGoal;
      let need = defaultNeed;
      let strategy: BreedStrategy | null = null;

      try {
        const strategyRes = await fetch("/api/generate-strategy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ breed: trimmed }),
        });
        const strategyData: unknown = await strategyRes.json();
        if (
          strategyRes.ok &&
          typeof strategyData === "object" &&
          strategyData !== null &&
          !(
            "error" in strategyData &&
            (strategyData as { error?: unknown }).error
          )
        ) {
          strategy = normalizeStrategy(strategyData);
          const adj = applyStrategyToGoalNeed(strategy, goal, need);
          goal = adj.goal;
          need = adj.need;
        } else {
          console.error(
            "[flow] generate-strategy (견종 재설정) 실패",
            strategyData
          );
        }
      } catch (e) {
        console.error("[flow] generate-strategy (견종 재설정) 요청 오류", e);
      }

      const trimmedPrompt = prompt.trim();
      if (trimmedPrompt) {
        try {
          const res = await fetch("/api/ai-test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: trimmedPrompt,
              analyzeOnly: true,
            }),
          });
          const data: unknown = await res.json();
          if (res.ok && typeof data === "object" && data !== null) {
            const ai = (data as { ai?: unknown }).ai;
            if (typeof ai === "object" && ai !== null) {
              const a = ai as Record<string, unknown>;
              if (typeof a.goal === "string" && a.goal.trim() !== "") {
                goal = a.goal.trim();
              }
              if (typeof a.need === "string" && a.need.trim() !== "") {
                need = a.need.trim();
              }
            }
          }
        } catch (e) {
          console.error("[flow] AI 텍스트 (견종 재설정) 오류", e);
        }
      }

      const foods = recommendFoods({ goal, need, type: ["food"] });
      const foodsWithReasons = await attachFoodReasons(foods, goal, need, {
        age,
        weight,
        activity,
        breed: trimmed,
      });
      setRecommendedFoods(foodsWithReasons);
      setRecommendGoal(goal);
      setRecommendNeed(need);

      setFlowBreedInsight((prev) => {
        const conf = prev?.confidence ?? 0.85;
        const lines = buildBreedStrategySummary(trimmed, conf, strategy);
        let breedLine = lines.breedLine;
        if (mode === "same") {
          breedLine = `${trimmed}으로 분석된 견종이 맞다고 확정했습니다.`;
        } else if (mode === "edited") {
          breedLine = `${trimmed}으로 수정해 반영했습니다.`;
        }
        return {
          breed: trimmed,
          confidence: conf,
          strategy,
          breedLine,
          strategyLine: lines.strategyLine,
        };
      });

      const q = new URLSearchParams({ goal, need });
      router.replace(`/flow/recommend?${q.toString()}`);
      console.log("[flow] 견종 재반영 완료:", trimmed, goal, need);
    },
    [age, weight, activity, dietNeeded, prompt, router]
  );

  const simulate = useCallback(
    (snackKcal: number): SimulationResult | null => {
      const w = parseWeightKg(weight);
      if (w === null) {
        return null;
      }
      return runSimulate(w, activity, snackKcal);
    },
    [weight, activity]
  );

  const selectSnack = useCallback(
    (snack: Snack) => {
      const result = simulate(snack.kcal);
      setSelectedSnack(snack);
      setSimulationResult(result);
      setAlternatives([]);
      setBasisOpenDetail(false);
      router.push("/flow/simulation");
    },
    [simulate, router]
  );

  const showAlternative = useCallback(() => {
    const snack = selectedSnackRef.current;
    if (!snack) {
      return;
    }
    const alts = pickLowerCalorieSnacks(snack.kcal, snackList);
    setAlternatives(alts);
    router.push("/flow/alternative");
  }, [router]);

  const selectAlternative = useCallback(
    (snack: Snack) => {
      const result = simulate(snack.kcal);
      setSelectedSnack(snack);
      setSimulationResult(result);
      setAlternatives([]);
      setBasisOpenDetail(false);
      router.push("/flow/simulation");
    },
    [simulate, router]
  );

  const flowBack = useCallback(() => {
    if (pathname === "/flow/simulation") {
      setSelectedSnack(null);
      setSimulationResult(null);
      setAlternatives([]);
      setBasisOpenDetail(false);
      router.push("/flow/recommend");
    } else if (pathname === "/flow/alternative") {
      router.push("/flow/simulation");
    }
  }, [pathname, router]);

  const toggleBasisDetail = useCallback(() => {
    setBasisOpenDetail((prev) => !prev);
  }, []);

  const triggerPickPhoto = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const value: DogAppContextValue = {
    isAuthenticated,
    authReady,
    photoPreview,
    photoName,
    age,
    weight,
    activity,
    dietNeeded,
    prompt,
    recommendGoal,
    recommendNeed,
    recommendedFoods,
    flowBreedInsight,
    recommendedList,
    selectedSnack,
    simulationResult,
    alternatives,
    basisOpenDetail,
    login,
    logout,
    setPhotoFromFile,
    goToPhoto,
    goToInput,
    goToRecommend,
    setAge,
    setWeight,
    setActivity,
    setDietNeeded,
    setPrompt,
    setInputFlowPhoto,
    syncRecommendFromSearchParams,
    refreshRecommendationFromBreed,
    selectSnack,
    showAlternative,
    selectAlternative,
    flowBack,
    toggleBasisDetail,
    triggerPickPhoto,
    fileInputRef,
  };

  return (
    <DogAppContext.Provider value={value}>{children}</DogAppContext.Provider>
  );
}
