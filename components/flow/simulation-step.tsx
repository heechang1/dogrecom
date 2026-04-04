"use client";

import { useDogApp } from "@/components/dog-app-context";
import { ResultFooter } from "@/components/flow/result-footer";
import {
  formatWeightChangeHeadline,
  parseWeightKg,
  round1,
} from "@/lib/simulation";

function handlePurchasePlaceholder() {}

export function SimulationStep() {
  const {
    weight,
    selectedSnack,
    simulationResult: sim,
    basisOpenDetail: basisOpen,
    flowBack,
    goToInput,
    showAlternative,
    toggleBasisDetail,
  } = useDogApp();

  const weightKg = parseWeightKg(weight);
  let invalidReason: string | null = null;
  if (weightKg === null) {
    invalidReason =
      "시뮬레이션을 보려면 입력 화면에서 유효한 체중(kg)을 입력해 주세요.";
  }

  if (!selectedSnack) {
    return (
      <>
        <div className="card flow-card">
          <p className="flow-step-badge">2 / 3 · 시뮬레이션</p>
          <p className="sim-invalid">
            선택된 간식이 없습니다. 추천 화면으로 돌아가 주세요.
          </p>
          <button
            type="button"
            className="btn btn-primary flow-cta-full"
            onClick={() => flowBack()}
          >
            추천으로 돌아가기
          </button>
        </div>
        <ResultFooter />
      </>
    );
  }

  const snack = selectedSnack;

  if (invalidReason) {
    return (
      <>
        <button
          type="button"
          className="btn-flow-back"
          onClick={() => flowBack()}
        >
          ← 추천으로
        </button>
        <div className="card flow-card">
          <p className="flow-step-badge">2 / 3 · 시뮬레이션</p>
          <div className="sim-card sim-card--muted">
            <p className="sim-invalid">{invalidReason}</p>
          </div>
          <button
            type="button"
            className="btn btn-primary flow-cta-full"
            onClick={() => goToInput()}
          >
            입력하러 가기
          </button>
        </div>
        <ResultFooter />
      </>
    );
  }

  if (!sim) {
    return (
      <>
        <button
          type="button"
          className="btn-flow-back"
          onClick={() => flowBack()}
        >
          ← 추천으로
        </button>
        <div className="card flow-card">
          <p className="flow-step-badge">2 / 3 · 시뮬레이션</p>
          <p className="sim-invalid">시뮬레이션을 계산할 수 없습니다.</p>
        </div>
        <ResultFooter />
      </>
    );
  }

  const surplus = sim.surplus;
  const headline = formatWeightChangeHeadline(surplus, sim.weightChange);
  let statusClass = "sim-status sim-status--gain";
  if (surplus === 0) {
    statusClass = "sim-status sim-status--neutral";
  } else if (surplus < 0) {
    statusClass = "sim-status sim-status--loss";
  }

  const rerText = round1(sim.rer);
  const merText = round1(sim.mer);
  const surplusText = round1(sim.surplus);
  const wcText = round1(sim.weightChange);
  const formulaLine =
    "(" + surplusText + " kcal/일 × 30일) ÷ 7700 ≈ " + wcText + "kg";
  const basisBtnLabel = basisOpen ? "계산 근거 접기" : "계산 근거 보기";
  const showGain = surplus > 0;

  return (
    <>
      <button
        type="button"
        className="btn-flow-back"
        onClick={() => flowBack()}
      >
        ← 추천으로
      </button>
      <div className="card flow-card">
        <p className="flow-step-badge">2 / 3 · 시뮬레이션</p>
        <div className="sim-card flow-sim-inner" role="region">
          <p className="sim-snack-ref">
            {snack.name + " · 1회 " + snack.kcal + " kcal"}
          </p>
          <p className="sim-weight-hero">{headline}</p>
          <p className={statusClass}>{sim.message}</p>

          {showGain ? (
            <div className="gain-ux gain-ux--compact">
              <p className="gain-ux-line gain-ux-line--warn">
                ⚠️ 체중 증가 위험이 있어요
              </p>
              <p className="gain-ux-line gain-ux-line--tip">
                👉 하루 1회로 줄이세요
              </p>
              <button
                type="button"
                className="btn btn-primary flow-cta-full"
                onClick={() => showAlternative()}
              >
                저칼로리 대안 보기
              </button>
            </div>
          ) : (
            <div className="sim-section">
              <p className="sim-section-title">추천 행동</p>
              <ul className="sim-tip-list">
                <li>하루 2회 → 1회로 줄이세요</li>
                <li>저칼로리 간식으로 변경 추천</li>
              </ul>
              <button
                type="button"
                className="btn btn-primary flow-cta-full"
                onClick={() => flowBack()}
              >
                다른 추천 간식 고르기
              </button>
            </div>
          )}

          <button
            type="button"
            className="btn btn-secondary flow-cta-secondary"
            onClick={handlePurchasePlaceholder}
          >
            그래도 구매하기
          </button>

          <button
            type="button"
            className="btn btn-basis"
            onClick={() => toggleBasisDetail()}
            aria-expanded={basisOpen}
          >
            {basisBtnLabel}
          </button>

          {basisOpen ? (
            <div className="basis-panel">
              <dl className="basis-dl">
                <dt>RER (안정 에너지 요구량)</dt>
                <dd>{rerText} kcal/일</dd>
                <dt>MER (유지 에너지 요구량)</dt>
                <dd>{merText} kcal/일</dd>
                <dt>간식 칼로리 합 (하루, 2회)</dt>
                <dd>{snack.kcal * 2} kcal/일</dd>
                <dt>초과 칼로리 (surplus)</dt>
                <dd>{surplusText} kcal/일</dd>
                <dt>30일 체중 변화 계산식</dt>
                <dd className="basis-formula">{formulaLine}</dd>
              </dl>
              <p className="basis-note">
                본 시뮬레이터는 교육용 단순 모델입니다. 질환·개체 차이는
                반영되지 않으므로 실제 급여는 수의사와 상담하세요.
              </p>
            </div>
          ) : null}
        </div>
      </div>
      <ResultFooter />
    </>
  );
}
