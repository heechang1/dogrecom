"use client";

import { useCallback, useState } from "react";
import type { ChangeEvent } from "react";
import Link from "next/link";
import type { FoodCategory, FoodDraft, FoodParsedSnapshot } from "@/lib/food-record";
import { parseFoodText } from "@/lib/food-text-parse";
import { processOCR } from "@/lib/ocr-ingredient-pipeline";

const CATEGORIES: FoodCategory[] = ["diet", "normal", "hypoallergenic"];

function snapshotToDraft(p: FoodParsedSnapshot): FoodDraft {
  let category: FoodCategory = "normal";
  if (p.tags.includes("다이어트") || p.tags.includes("저지방")) {
    category = "diet";
  } else if (p.tags.includes("저알러지")) {
    category = "hypoallergenic";
  }
  return {
    name: p.name,
    brand: p.brand ?? "",
    protein: p.protein,
    fat: p.fat,
    fiber: p.fiber,
    kcal: p.kcal,
    ingredients: p.ingredients,
    tags: p.tags,
    feature: p.feature,
    target: p.target,
    category,
  };
}

function draftToForm(d: FoodDraft) {
  return {
    name: d.name,
    brand: d.brand,
    protein: d.protein !== null ? String(d.protein) : "",
    fat: d.fat !== null ? String(d.fat) : "",
    fiber: d.fiber !== null ? String(d.fiber) : "",
    ingredients: d.ingredients.join(", "),
    tags: d.tags.join(", "),
    target: d.target.join(", "),
    category: d.category,
  };
}

export function FoodOcrClient() {
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [showOcr, setShowOcr] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    protein: "",
    fat: "",
    ash: "",
    moisture: "",
  });
  /** textarea: 원재료 블록 원문 (키워드 직후 ~300자, processOCR.ingredientBlock) */
  const [ingredientRaw, setIngredientRaw] = useState("");
  /** 내부용 필터된 원재료 배열 */
  const [ingredientsParsed, setIngredientsParsed] = useState<string[]>([]);
  const [brand, setBrand] = useState("");
  const [fiber, setFiber] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [tags, setTags] = useState("");
  const [target, setTarget] = useState("");
  const [category, setCategory] = useState<FoodCategory>("normal");
  /** OCR 파이프라인 OpenAI 요약 → 저장 시 feature 로 전달 (수동 편집 없음) */
  const [aiSummary, setAiSummary] = useState("");

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const key = e.currentTarget.name;
      const value = e.currentTarget.value;

      if (key === "name") {
        setForm((prev) => ({ ...prev, name: value }));
        return;
      }
      if (key === "protein") {
        setForm((prev) => ({ ...prev, protein: value }));
        return;
      }
      if (key === "fat") {
        setForm((prev) => ({ ...prev, fat: value }));
        return;
      }
      if (key === "ash") {
        setForm((prev) => ({ ...prev, ash: value }));
        return;
      }
      if (key === "moisture") {
        setForm((prev) => ({ ...prev, moisture: value }));
        return;
      }
      if (key === "ingredientRaw") {
        setIngredientRaw(value);
        return;
      }
      if (key === "weightKg") {
        setWeightKg(value);
        return;
      }
    },
    []
  );

  const applyParsed = useCallback((d: FoodDraft) => {
    const f = draftToForm(d);
    setForm((prev) => ({
      ...prev,
      name: f.name,
      protein: f.protein,
      fat: f.fat,
      // ash/moisture는 현재 AI 파싱 결과가 없으므로 prev 값을 유지합니다.
    }));
    setIngredientRaw(f.ingredients);
    setIngredientsParsed(
      f.ingredients
        .split(/[,，、]/)
        .map((s) => s.trim())
        .filter((s) => s !== "")
    );
    setBrand(f.brand);
    setFiber(f.fiber);
    setTags(f.tags);
    setTarget(f.target);
    setCategory(f.category);
    setConfirmed(false);
    setSaveMsg(null);
  }, []);

  const onFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setBusy(true);
      setSaveMsg(null);
      setAiSummary("");
      setWeightKg("");
      try {
        const fd = new FormData();
        fd.set("image", file);
        console.log(
          "[food-ocr] 클라이언트 → 서버 OCR 요청:",
          file.name,
          "size:",
          file.size
        );
        const res = await fetch("/api/food/ocr", {
          method: "POST",
          body: fd,
        });
        const data: unknown = await res.json();
        if (!res.ok || typeof data !== "object" || data === null) {
          console.error("[food-ocr] OCR 응답 오류", data);
          setSaveMsg("OCR 요청에 실패했습니다.");
          return;
        }
        const o = data as {
          success?: boolean;
          ocrText?: string;
          parsed?: FoodDraft;
          error?: string;
          visionBlockBased?: boolean;
          visionIngredientBlock?: string;
          visionIngredients?: string[];
          structuredProduct?: {
            name: string;
            brand: string;
            weight: number | null;
            protein: number | null;
            fat: number | null;
            fiber: number | null;
            ash: number | null;
            moisture: number | null;
            category: string;
            summary: string;
          };
        };
        if (!o.success) {
          console.error("[food-ocr]", o.error);
          setSaveMsg(o.error ?? "OCR 실패");
          return;
        }
        const txt = o.ocrText ?? "";
        console.log("[food-ocr] 서버 → 클라이언트 ocrText.length:", txt.length);
        console.log("[food-ocr] ocrText 전체:\n", txt);
        setOcrText(txt);
        setShowOcr(true);

        // OCR raw text 기반 자동 파싱 (UI 입력 자동 채움)
        console.log("OCR length:", txt.length);
        const parsedAuto = parseFoodText(txt);
        console.log("parsed:", parsedAuto);
        console.log("[food-ocr] parseFoodText(parsedAuto):", parsedAuto);
        setForm({
          name: parsedAuto.name || "",
          protein: parsedAuto.protein || "",
          fat: parsedAuto.fat || "",
          ash: parsedAuto.ash || "",
          moisture: parsedAuto.moisture || "",
        });

        const serverBlock =
          typeof o.visionIngredientBlock === "string" &&
          o.visionIngredientBlock.trim() !== ""
            ? o.visionIngredientBlock
            : "";
        const serverList =
          Array.isArray(o.visionIngredients) ? o.visionIngredients : [];

        if (serverBlock !== "") {
          console.log(
            "[food-ocr] 서버 Vision 블록 기반 ingredientBlock 사용:",
            serverBlock.length
          );
          setIngredientRaw(serverBlock);
          setIngredientsParsed(serverList);
        } else {
          const ocrIng = processOCR(txt);
          if (ocrIng.ingredientBlock !== "") {
            setIngredientRaw(ocrIng.ingredientBlock);
            setIngredientsParsed(ocrIng.ingredients);
          } else {
            setIngredientRaw("");
            setIngredientsParsed([]);
          }
        }

        if (o.parsed) {
          applyParsed(o.parsed);
          if (serverBlock !== "") {
            setIngredientRaw(serverBlock);
            setIngredientsParsed(serverList);
          }
        }

        const sp = o.structuredProduct;
        setAiSummary(sp && typeof sp.summary === "string" ? sp.summary : "");
        if (sp) {
          if (sp.category === "다이어트") {
            setCategory("diet");
          } else if (sp.category === "알러지") {
            setCategory("hypoallergenic");
          } else if (sp.category === "일반") {
            setCategory("normal");
          }
          setForm((prev) => ({
            ...prev,
            name:
              sp.name && sp.name.trim() !== ""
                ? sp.name.trim()
                : prev.name,
            protein:
              sp.protein !== null && sp.protein !== undefined
                ? String(sp.protein)
                : prev.protein,
            fat:
              sp.fat !== null && sp.fat !== undefined
                ? String(sp.fat)
                : prev.fat,
            ash:
              sp.ash !== null && sp.ash !== undefined
                ? String(sp.ash)
                : prev.ash,
            moisture:
              sp.moisture !== null && sp.moisture !== undefined
                ? String(sp.moisture)
                : prev.moisture,
          }));
          if (sp.brand && sp.brand.trim() !== "") {
            setBrand(sp.brand.trim());
          }
          if (sp.fiber !== null && sp.fiber !== undefined) {
            setFiber(String(sp.fiber));
          }
          if (sp.weight !== null && sp.weight !== undefined) {
            setWeightKg(String(sp.weight));
          }
        }
      } catch (e) {
        console.error("[food-ocr] 요청 오류", e);
        setSaveMsg("네트워크 오류가 났습니다.");
      } finally {
        setBusy(false);
      }
    },
    [applyParsed]
  );

  const runAiParse = useCallback(async () => {
    const raw = ocrText.trim();
    if (!raw) {
      setSaveMsg("먼저 OCR 텍스트가 있어야 합니다.");
      return;
    }
    setAiBusy(true);
    setSaveMsg(null);
    try {
      const payload = { rawText: raw };
      console.log(
        "[food-ocr] /api/food/parse 요청 rawText.length:",
        raw.length
      );
      console.log("[food-ocr] /api/food/parse rawText 전체:\n", raw);
      const res = await fetch("/api/food/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: unknown = await res.json();
      if (!res.ok || typeof data !== "object" || data === null) {
        console.error("[food-ocr] AI parse 오류", data);
        setSaveMsg("AI 정제 요청에 실패했습니다.");
        return;
      }
      const o = data as {
        success?: boolean;
        parsed?: FoodParsedSnapshot;
        fallbackUsed?: boolean;
        error?: string;
      };
      if (!o.success) {
        setSaveMsg(o.error ?? "AI 정제 실패");
        return;
      }
      if (o.parsed) {
        applyParsed(snapshotToDraft(o.parsed));
      }
      if (o.fallbackUsed) {
        setSaveMsg(
          "AI 정제가 불완전해 원문 위주로 채웠습니다. 폼을 꼭 확인해 주세요."
        );
      }
    } catch (e) {
      console.error("[food-ocr] AI parse 요청 오류", e);
      setSaveMsg("네트워크 오류가 났습니다.");
    } finally {
      setAiBusy(false);
    }
  }, [ocrText, applyParsed]);

  const markDirty = useCallback(() => {
    setConfirmed(false);
  }, []);

  const save = useCallback(async () => {
    setSaveBusy(true);
    setSaveMsg(null);
    try {
      const body = {
        name: form.name.trim(),
        brand: brand.trim(),
        protein:
          form.protein.trim() === "" ? null : Number(form.protein.replace(/,/g, "")),
        fat: form.fat.trim() === "" ? null : Number(form.fat.replace(/,/g, "")),
        fiber: fiber.trim() === "" ? null : Number(fiber.replace(/,/g, "")),
        ingredients: ingredientRaw,
        tags,
        feature: aiSummary.trim(),
        target,
        category,
      };
      const res = await fetch("/api/food/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: unknown = await res.json();
      if (!res.ok || typeof data !== "object" || data === null) {
        console.error("[food-ocr] 저장 응답 오류", data);
        setSaveMsg("저장에 실패했습니다.");
        return;
      }
      if ((data as { success?: boolean }).success !== true) {
        setSaveMsg(
          (data as { error?: string }).error ?? "입력값을 확인해 주세요."
        );
        return;
      }
      const foodObj = (data as { food?: { id?: number } }).food;
      const id = foodObj && typeof foodObj.id === "number" ? foodObj.id : undefined;
      setSaveMsg(
        typeof id === "number"
          ? `저장 완료 (ID ${id}). 추천에는 다음 빌드·새로고침 후 반영됩니다.`
          : "저장 완료."
      );
      setConfirmed(false);
    } catch (e) {
      console.error("[food-ocr] 저장 오류", e);
      setSaveMsg("저장 중 오류가 났습니다.");
    } finally {
      setSaveBusy(false);
    }
  }, [
    form.name,
    brand,
    form.protein,
    form.fat,
    fiber,
    ingredientRaw,
    tags,
    aiSummary,
    target,
    category,
  ]);

  return (
    <div className="min-h-screen p-4 pt-8 pb-16">
      <div className="card flow-card max-w-lg mx-auto">
        <div className="flex justify-between items-center gap-2 mb-4">
          <h1 className="text-lg font-semibold">사료 라벨 OCR → DB</h1>
          <Link
            href="/flow/recommend?goal=normal&need=balanced"
            className="text-sm text-gray-600 underline shrink-0"
          >
            추천으로
          </Link>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          사진 업로드 → OCR → (선택) OpenAI 정제 → 폼 확인·수정 → 확인 후
          저장합니다.
        </p>

        <label className="block text-sm font-medium text-gray-800 mb-1">
          라벨 이미지
        </label>
        <input
          type="file"
          accept="image/*"
          className="block w-full text-sm text-gray-600 mb-4"
          disabled={busy}
          onChange={(e) => {
            let f: File | null = null;
            const files = e.currentTarget.files;
            if (files && files.length > 0) {
              f = files[0];
            }
            void onFile(f);
            e.target.value = "";
          }}
        />
        {busy ? (
          <p className="text-sm text-gray-500 mb-4">OCR 처리 중… (최대 1분)</p>
        ) : null}

        {ocrText ? (
          <div className="mb-4">
            <button
              type="button"
              className="text-sm text-gray-600 underline mb-1"
              onClick={() => setShowOcr((v) => !v)}
            >
              {showOcr ? "OCR 원문 접기" : "OCR 원문 보기"}
            </button>
            {showOcr ? (
              <pre className="text-xs bg-gray-50 border border-gray-100 rounded p-2 max-h-40 overflow-auto whitespace-pre-wrap">
                {ocrText}
              </pre>
            ) : null}
            <button
              type="button"
              className="btn btn-secondary w-full mt-2 py-2 text-sm"
              disabled={aiBusy || !ocrText.trim()}
              onClick={() => void runAiParse()}
            >
              {aiBusy ? "OpenAI 정제 중…" : "OpenAI로 텍스트 정제"}
            </button>
          </div>
        ) : null}

        <div className="space-y-3 border-t border-gray-100 pt-4">
          <p className="text-sm font-medium text-gray-800">검수·수정</p>

          <div>
            <label className="text-xs text-gray-600" htmlFor="fo-name">
              제품명 <span className="text-red-600">*</span>
            </label>
            <input
              id="fo-name"
              name="name"
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm mt-0.5"
              value={form.name}
              onChange={(e) => {
                markDirty();
                handleChange(e);
              }}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600" htmlFor="fo-brand">
              브랜드
            </label>
            <input
              id="fo-brand"
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm mt-0.5"
              value={brand}
              onChange={(e) => {
                markDirty();
                setBrand(e.target.value);
              }}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600" htmlFor="fo-weight">
              중량 (kg)
            </label>
            <input
              id="fo-weight"
              name="weightKg"
              type="number"
              step="0.01"
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm mt-0.5"
              value={weightKg}
              onChange={(e) => {
                markDirty();
                handleChange(e);
              }}
            />
          </div>
          <p className="text-xs font-medium text-gray-700">성분</p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-600" htmlFor="fo-protein">
                단백질 % *
              </label>
              <input
                id="fo-protein"
                name="protein"
                type="number"
                step="0.1"
                className="w-full border border-gray-200 rounded-md px-2 py-2 text-sm mt-0.5"
                value={form.protein}
                onChange={(e) => {
                  markDirty();
                  handleChange(e);
                }}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600" htmlFor="fo-fat">
                지방 % *
              </label>
              <input
                id="fo-fat"
                name="fat"
                type="number"
                step="0.1"
                className="w-full border border-gray-200 rounded-md px-2 py-2 text-sm mt-0.5"
                value={form.fat}
                onChange={(e) => {
                  markDirty();
                  handleChange(e);
                }}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600" htmlFor="fo-fiber">
                섬유 % *
              </label>
              <input
                id="fo-fiber"
                type="number"
                step="0.1"
                className="w-full border border-gray-200 rounded-md px-2 py-2 text-sm mt-0.5"
                value={fiber}
                onChange={(e) => {
                  markDirty();
                  setFiber(e.target.value);
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-600" htmlFor="fo-ash">
                조회분 % *
              </label>
              <input
                id="fo-ash"
                name="ash"
                type="number"
                step="0.1"
                className="w-full border border-gray-200 rounded-md px-2 py-2 text-sm mt-0.5"
                value={form.ash}
                onChange={(e) => {
                  markDirty();
                  handleChange(e);
                }}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600" htmlFor="fo-moisture">
                수분 % *
              </label>
              <input
                id="fo-moisture"
                name="moisture"
                type="number"
                step="0.1"
                className="w-full border border-gray-200 rounded-md px-2 py-2 text-sm mt-0.5"
                value={form.moisture}
                onChange={(e) => {
                  markDirty();
                  handleChange(e);
                }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-600" htmlFor="fo-ing">
              원재료 블록 (OCR 추출 구간, 직접 수정 가능)
            </label>
            <textarea
              id="fo-ing"
              name="ingredientRaw"
              rows={2}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm mt-0.5"
              value={ingredientRaw}
              onChange={(e) => {
                markDirty();
                handleChange(e);
              }}
            />
            {ingredientsParsed.length > 0 ? (
              <p className="text-[11px] text-gray-500 mt-1">
                파싱된 항목 {ingredientsParsed.length}개 (내부 참고)
              </p>
            ) : null}
          </div>
          <div>
            <label className="text-xs text-gray-600" htmlFor="fo-feat-summary">
              특징 요약
            </label>
            <div
              id="fo-feat-summary"
              className="ai-summary-box mt-0.5 text-gray-900 leading-snug whitespace-pre-wrap"
              role="status"
              aria-live="polite"
            >
              {aiSummary.trim() !== "" ? (
                aiSummary
              ) : (
                <span className="text-gray-500">
                  OCR 후 OpenAI 파이프라인 요약이 여기에 표시됩니다. (API 키·
                  라벨 인식 여부에 따라 비어 있을 수 있습니다.)
                </span>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600" htmlFor="fo-tags">
              태그 (쉼표 구분) *
            </label>
            <input
              id="fo-tags"
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm mt-0.5"
              placeholder="예: 다이어트, 유기농"
              value={tags}
              onChange={(e) => {
                markDirty();
                setTags(e.target.value);
              }}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600" htmlFor="fo-cat">
              분류 *
            </label>
            <select
              id="fo-cat"
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm mt-0.5"
              value={category}
              onChange={(e) => {
                markDirty();
                setCategory(e.target.value as FoodCategory);
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c === "diet"
                    ? "다이어트(diet)"
                    : c === "hypoallergenic"
                      ? "저알러지(hypoallergenic)"
                      : "일반(normal)"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600" htmlFor="fo-target">
              타겟 (쉼표 구분, 선택)
            </label>
            <input
              id="fo-target"
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm mt-0.5"
              value={target}
              onChange={(e) => {
                markDirty();
                setTarget(e.target.value);
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-6 pt-4 border-t border-gray-100">
          <button
            type="button"
            className="btn btn-secondary w-full py-2"
            onClick={() => {
              markDirty();
            }}
          >
            수정하기 (입력란 편집)
          </button>
          <button
            type="button"
            className={`btn w-full py-2 ${confirmed ? "btn-primary" : "bg-amber-50 border border-amber-200 text-amber-900"}`}
            onClick={() => setConfirmed(true)}
          >
            이 정보 맞나요? — 확인
          </button>
          <button
            type="button"
            className="btn btn-primary w-full py-3"
            disabled={saveBusy || !confirmed}
            onClick={() => void save()}
          >
            {saveBusy ? "저장 중…" : "DB(foods.json)에 저장"}
          </button>
          {!confirmed ? (
            <p className="text-xs text-gray-500 text-center">
              저장 전 &quot;이 정보 맞나요? — 확인&quot;을 눌러 주세요.
            </p>
          ) : null}
        </div>

        {saveMsg ? (
          <p
            className="mt-4 text-sm text-center rounded-md py-2 px-2 bg-emerald-50 border border-emerald-100 text-gray-800"
            role="status"
          >
            {saveMsg}
          </p>
        ) : null}
      </div>
    </div>
  );
}
