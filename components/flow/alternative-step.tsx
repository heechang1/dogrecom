"use client";

import { useDogApp } from "@/components/dog-app-context";
import { ResultFooter } from "@/components/flow/result-footer";

function handlePurchasePlaceholder() {}

export function AlternativeStep() {
  const { alternatives, flowBack, selectAlternative } = useDogApp();

  return (
    <>
      <button
        type="button"
        className="btn-flow-back"
        onClick={() => flowBack()}
      >
        ← 시뮬레이션으로
      </button>
      <div className="card flow-card">
        <p className="flow-step-badge">3 / 3 · 저칼로리 대안</p>
        <p className="flow-one-action-hint">
          현재 간식보다 1회 칼로리가 낮은 항목입니다. 하나를 고르면 시뮬 화면으로
          돌아갑니다.
        </p>

        {alternatives.length === 0 ? (
          <>
            <p className="lcc-empty">더 낮은 칼로리 간식이 목록에 없어요.</p>
            <button
              type="button"
              className="btn btn-primary flow-cta-full"
              onClick={() => flowBack()}
            >
              시뮬레이션으로 돌아가기
            </button>
          </>
        ) : (
          <ul className="lcc-grid">
            {alternatives.map(function (item) {
              return (
                <li className="lcc-card" key={item.id}>
                  <p className="lcc-card-name">{item.name}</p>
                  <p className="lcc-card-kcal">1회 {item.kcal} kcal</p>
                  <p className="lcc-card-desc">{item.desc}</p>
                  <button
                    type="button"
                    className="btn btn-primary flow-cta-full"
                    onClick={function () {
                      selectAlternative(item);
                    }}
                  >
                    이 간식으로 시뮬레이션
                  </button>
                  <button
                    type="button"
                    className="btn btn-lcc-buy"
                    onClick={handlePurchasePlaceholder}
                  >
                    구매하기
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <ResultFooter />
    </>
  );
}
