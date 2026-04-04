"use client";

import { useState } from "react";
import { useDogApp } from "@/components/dog-app-context";

export function InputStep() {
  const {
    age,
    weight,
    activity,
    dietNeeded,
    prompt,
    photoPreview,
    setAge,
    setWeight,
    setActivity,
    setDietNeeded,
    setPrompt,
    setInputFlowPhoto,
    goToRecommend,
    goToPhoto,
  } = useDogApp();

  const [submitting, setSubmitting] = useState(false);

  async function handleRecommend() {
    setSubmitting(true);
    try {
      await goToRecommend();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="card">
        <label className="card-label" htmlFor="dog-age">
          나이 (세)
        </label>
        <div className="field">
          <input
            id="dog-age"
            className="input"
            type="number"
            min={0}
            step={0.1}
            placeholder="예: 3"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>
        <label className="card-label" htmlFor="dog-weight">
          체중 (kg)
        </label>
        <div className="field">
          <input
            id="dog-weight"
            className="input"
            type="number"
            min={0}
            step={0.1}
            placeholder="예: 7.5"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
        <label className="card-label" htmlFor="dog-activity">
          활동량
        </label>
        <div className="field">
          <select
            id="dog-activity"
            className="select"
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
          >
            <option value="낮음">낮음 (주로 실내) — 계수 1.2</option>
            <option value="보통">보통 (산책 1~2회) — 계수 1.6</option>
            <option value="높음">높음 (산책·놀이 많음) — 계수 2.0</option>
          </select>
        </div>
        <label className="card-label" htmlFor="dog-breed-photo">
          견종 분석용 사진 (선택)
        </label>
        <div className="field">
          <input
            id="dog-breed-photo"
            className="input py-2"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setInputFlowPhoto(f);
            }}
          />
          <p className="text-xs text-gray-500 mt-1">
            비워 두면 이전 단계에서 올린 사진이 있을 때 그 이미지로 분석합니다.
            {photoPreview ? " (현재 미리보기 있음)" : ""}
          </p>
        </div>
        <label className="card-label" htmlFor="dog-prompt">
          강아지 상태 (선택)
        </label>
        <div className="field">
          <textarea
            id="dog-prompt"
            className="input min-h-[88px] py-2 resize-y"
            rows={3}
            placeholder="강아지 상태를 자유롭게 입력하세요 (예: 살 찌우고 싶어요, 알러지 있어요)"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>
        <div className="field field-diet">
          <label className="diet-check-label">
            <input
              type="checkbox"
              className="diet-check-input"
              checked={dietNeeded}
              onChange={(e) => setDietNeeded(e.target.checked)}
            />
            <span>다이어트·체중 관리 필요 (저칼로리 간식 위주 추천)</span>
          </label>
        </div>
      </div>
      <div className="page-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={submitting}
          onClick={() => void handleRecommend()}
        >
          {submitting ? "분석 중…" : "추천 받기"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={submitting}
          onClick={() => goToPhoto()}
        >
          이전
        </button>
      </div>
    </>
  );
}
