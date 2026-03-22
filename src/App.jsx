import React, { Component } from "react";
import "./App.css";

/** 앱 전체 접근용 비밀번호 (데모용 — 운영 시 서버 인증으로 교체 권장) */
const PASSWORD = "1234";

/** localStorage에 로그인 유지 여부 저장 키 */
const AUTH_STORAGE_KEY = "auth";

/** 활동량 UI 값 → 계수 (LOW / NORMAL / HIGH) */
const ACTIVITY_FACTOR = {
  낮음: 1.2,
  보통: 1.6,
  높음: 2.0,
};

/**
 * 활동 계수 조회 (명세: LOW 1.2, NORMAL 1.6, HIGH 2.0)
 */
function getActivityMultiplier(activityLabel) {
  const factor = ACTIVITY_FACTOR[activityLabel];
  if (typeof factor === "number") {
    return factor;
  }
  return ACTIVITY_FACTOR["보통"];
}

/**
 * 급여 시뮬레이션 수치 계산
 * - RER = 70 * weight^0.75
 * - MER = RER * activityMultiplier
 * - 간식 합(하루) = snackKcal * 2
 * - surplus = snackTotal (명세)
 * - 30일 체중 변화 = (surplus * 30) / 7700
 */
function computeSimulation(weightKg, activityLabel, snackKcalPerServing) {
  const rer = 70 * Math.pow(weightKg, 0.75);
  const activityMultiplier = getActivityMultiplier(activityLabel);
  const mer = rer * activityMultiplier;
  const snackTotal = snackKcalPerServing * 2;
  const surplus = snackTotal;
  const weightChange30d = (surplus * 30) / 7700;

  return {
    rer: rer,
    mer: mer,
    snackTotal: snackTotal,
    surplus: surplus,
    weightChange30d: weightChange30d,
    activityMultiplier: activityMultiplier,
  };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * 체중 변화 헤드라인 (30일 기준)
 */
function formatWeightChangeHeadline(surplus, weightChange30d) {
  const absVal = round1(Math.abs(weightChange30d));
  if (surplus > 0) {
    return "+" + absVal + "kg 증가 예상 (30일 기준)";
  }
  if (surplus < 0) {
    return "-" + absVal + "kg 감소 예상 (30일 기준)";
  }
  return "0kg 변화 (30일 기준)";
}

/**
 * 초과 칼로리(surplus)에 따른 상태 메시지
 */
function getStatusMessage(surplus) {
  if (surplus > 0) {
    return "체중 증가 위험이 있어요";
  }
  if (surplus === 0) {
    return "현재 상태 유지 가능";
  }
  return "체중 감소 가능";
}

/**
 * 기존 computeSimulation을 재사용해 UI용 시뮬 결과 객체 생성
 * (클래스의 simulate(snackKcal)에서도 동일 로직 사용)
 */
function runSimulate(weightKg, activityLabel, snackKcal) {
  const m = computeSimulation(weightKg, activityLabel, snackKcal);
  const surplus = m.surplus;
  let status = "maintain";
  if (surplus > 0) {
    status = "gain";
  } else if (surplus < 0) {
    status = "loss";
  }
  return {
    weightChange: m.weightChange30d,
    status: status,
    message: getStatusMessage(surplus),
    rer: m.rer,
    mer: m.mer,
    surplus: surplus,
  };
}

/**
 * 전체 간식 카탈로그 (추천 알고리즘 + 저칼로리 분기 + 시뮬 공통)
 * - lowCal: 다이어트 모드에서 우선 추천
 * - category: "고단백" 등 활동량 높음 분기에 사용
 */
const snackList = [
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

/**
 * 배열 복사 후 Fisher-Yates 셔플 (균형·랜덤 추천용)
 */
function shuffleCopy(items) {
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

/**
 * 풀에서 최대 3개, 부족하면 전체 카탈로그에서 중복 없이 채움
 */
function pickUpToThreeUnique(pool, fullCatalog) {
  const result = [];
  const usedIds = {};
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

/**
 * 사용자 조건에 맞는 간식 3개 추천
 * @param {Array} list — snackList와 동일 스키마
 * @param {Object} userInfo — weight(kg 문자열·숫자), activityLevel, dietNeeded
 */
function getRecommended(list, userInfo) {
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

/**
 * 선택 간식보다 1회 kcal가 낮은 항목만, 최대 3개 (시뮬 surplus > 0 분기)
 */
function pickLowerCalorieSnacks(currentKcal, catalog) {
  const source = catalog || snackList;
  const lower = source.filter(function (item) {
    return item.kcal < currentKcal;
  });
  lower.sort(function (a, b) {
    return a.kcal - b.kcal;
  });
  return lower.slice(0, 3);
}

/**
 * 시뮬레이션 + 체중 증가 시 저칼로리 목록 + 나란히 비교 결과
 */
class SnackSimulationExperience extends Component {
  constructor(props) {
    super(props);
    this.state = {
      /** 저칼로리 후보 목록 패널 열림 */
      compareOpen: false,
      /** 기존(추천) 간식 기준 시뮬 결과 */
      baseSimulation: null,
      /** 비교할 저칼로리 간식 시뮬 결과 — 있을 때만 비교 UI 표시 */
      compareSimulation: null,
      /** 현재 선택된 기존 간식 메타 */
      selectedSnack: null,
      /** 비교 대상 저칼로리 간식 메타 */
      compareSnack: null,
    };

    if (!props.invalidReason) {
      const w = props.weightKg;
      if (w !== null && w !== undefined) {
        const n = typeof w === "number" ? w : parseFloat(w);
        if (!isNaN(n) && n > 0) {
          this.state.selectedSnack = {
            id: props.baseSnackId,
            name: props.baseSnackName,
            kcal: props.baseSnackKcal,
          };
          this.state.baseSimulation = runSimulate(n, props.activityLabel, props.baseSnackKcal);
        }
      }
    }
  }

  /**
   * 입력·추천 행이 바뀌면 기준 시뮬을 다시 계산하고 비교 상태는 초기화
   */
  componentDidUpdate(prevProps) {
    const p = this.props;
    if (prevProps.baseSnackId !== p.baseSnackId) {
      this.setState({
        compareOpen: false,
        compareSimulation: null,
        compareSnack: null,
      });
    }

    if (p.invalidReason) {
      if (
        this.state.baseSimulation !== null ||
        this.state.selectedSnack !== null ||
        this.state.compareSimulation !== null
      ) {
        this.setState({
          baseSimulation: null,
          selectedSnack: null,
          compareSimulation: null,
          compareSnack: null,
        });
      }
      return;
    }

    const baseInputsChanged =
      prevProps.weightKg !== p.weightKg ||
      prevProps.activityLabel !== p.activityLabel ||
      prevProps.baseSnackKcal !== p.baseSnackKcal ||
      prevProps.baseSnackId !== p.baseSnackId ||
      prevProps.invalidReason !== p.invalidReason;

    if (baseInputsChanged) {
      const w = p.weightKg;
      const selectedSnack = {
        id: p.baseSnackId,
        name: p.baseSnackName,
        kcal: p.baseSnackKcal,
      };
      const baseSimulation = runSimulate(w, p.activityLabel, p.baseSnackKcal);
      this.setState({
        selectedSnack: selectedSnack,
        baseSimulation: baseSimulation,
        compareSimulation: null,
        compareSnack: null,
      });
    }
  }

  /**
   * 1회 kcal 기준 시뮬레이션 (내부에서 computeSimulation 재사용)
   */
  simulate(snackKcal) {
    return runSimulate(this.props.weightKg, this.props.activityLabel, snackKcal);
  }

  /** 저칼로리 카드에서 비교 실행 */
  handleCompare = (snack) => {
    const result = this.simulate(snack.kcal);
    this.setState({
      compareSimulation: result,
      compareSnack: snack,
    });
  };

  /** 비교 결과만 지우기 (목록은 유지) */
  clearCompareResult = () => {
    this.setState({
      compareSimulation: null,
      compareSnack: null,
    });
  };

  /** 저칼로리 비교 영역 토글 */
  toggleCompareOpen = () => {
    this.setState(function (prev) {
      return { compareOpen: !prev.compareOpen };
    });
  };

  /**
   * 그래도 원래 간식 구매 — 배포 환경에서는 콘솔 출력 없음.
   * 결제/외부 스토어 링크는 여기서 연동하면 됩니다.
   */
  handlePurchaseAnyway = () => {};

  /**
   * 저칼로리 카드 구매 — 동일하게 연동 지점만 유지 (MVP는 빈 핸들러).
   */
  handleCardPurchase = function () {};

  render() {
    const invalidReason = this.props.invalidReason;
    if (invalidReason) {
      return (
        <div className="sim-card sim-card--muted" role="region" aria-label="시뮬레이터 안내">
          <p className="sim-invalid">{invalidReason}</p>
        </div>
      );
    }

    const weightKg = this.props.weightKg;
    const activityLabel = this.props.activityLabel;
    const baseSnackName = this.props.baseSnackName;
    const baseSnackKcal = this.props.baseSnackKcal;
    const basisOpen = this.props.basisOpen;
    const onToggleBasis = this.props.onToggleBasis;

    let baseSim = this.state.baseSimulation;
    let selectedSnack = this.state.selectedSnack;
    if (!baseSim || !selectedSnack) {
      baseSim = runSimulate(weightKg, activityLabel, baseSnackKcal);
      selectedSnack = {
        id: this.props.baseSnackId,
        name: baseSnackName,
        kcal: baseSnackKcal,
      };
    }

    const compareOpen = this.state.compareOpen;
    const compareSimulation = this.state.compareSimulation;
    const compareSnack = this.state.compareSnack;

    const surplus = baseSim.surplus;
    const weightChange30d = baseSim.weightChange;
    const headline = formatWeightChangeHeadline(surplus, weightChange30d);
    const statusMsg = baseSim.message;
    let statusClass = "sim-status sim-status--gain";
    if (surplus === 0) {
      statusClass = "sim-status sim-status--neutral";
    } else if (surplus < 0) {
      statusClass = "sim-status sim-status--loss";
    }

    const rerText = round1(baseSim.rer);
    const merText = round1(baseSim.mer);
    const surplusText = round1(baseSim.surplus);
    const wcText = round1(baseSim.weightChange);
    const formulaLine =
      "(" +
      surplusText +
      " kcal/일 × 30일) ÷ 7700 ≈ " +
      wcText +
      "kg";

    const basisBtnLabel = basisOpen ? "계산 근거 접기" : "계산 근거 보기";

    const showGainFlow = surplus > 0;
    /** App에서 계산한 저칼로리 대안이 있으면 우선 사용 (시뮬 surplus > 0 연동) */
    var recommendations;
    if (this.props.alternativesOverride !== undefined) {
      recommendations = this.props.alternativesOverride;
    } else {
      recommendations = pickLowerCalorieSnacks(baseSnackKcal, snackList);
    }
    const self = this;

    const compareMainLabel = compareOpen
      ? "저칼로리 간식 접기"
      : "저칼로리 간식 비교하기";

    const ariaLabel = selectedSnack.name + " 급여 시뮬레이션";

    /** 비교 카드: 증가 빨강 / 유지·감소 초록 */
    const cmpTone = function (status) {
      if (status === "gain") {
        return "#ff4d4f";
      }
      return "#52c41a";
    };

    const baseWcLine = formatWeightChangeHeadline(baseSim.surplus, baseSim.weightChange);

    return (
      <div className="sim-card" role="region" aria-label={ariaLabel}>
        <p className="sim-snack-ref">
          {selectedSnack.name + " · 1회 " + selectedSnack.kcal + " kcal"}
        </p>

        <p className="sim-weight-hero">{headline}</p>
        <p className={statusClass}>{statusMsg}</p>

        {showGainFlow ? (
          <div className="gain-ux">
            <p className="gain-ux-line gain-ux-line--warn">⚠️ 체중 증가 위험이 있어요</p>
            <p className="gain-ux-line gain-ux-line--tip">👉 하루 1회로 줄이세요</p>
            <button
              type="button"
              className="btn btn-primary btn-gain-primary"
              onClick={this.toggleCompareOpen}
              aria-expanded={compareOpen}
            >
              {compareMainLabel}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-gain-secondary"
              onClick={this.handlePurchaseAnyway}
            >
              그래도 구매하기
            </button>
          </div>
        ) : (
          <div className="sim-section">
            <p className="sim-section-title">추천 행동</p>
            <ul className="sim-tip-list">
              <li>하루 2회 → 1회로 줄이세요</li>
              <li>저칼로리 간식으로 변경 추천</li>
            </ul>
          </div>
        )}

        <div
          className={
            "compare-shell" + (showGainFlow && compareOpen ? " compare-shell--open" : "")
          }
          aria-hidden={!(showGainFlow && compareOpen)}
        >
          {showGainFlow && compareOpen ? (
            <div className="compare-inner">
              <div className="lcc-head">
                <h3 className="lcc-title">더 건강한 간식 추천</h3>
                <p className="lcc-desc">
                  체중 증가를 줄이기 위해 저칼로리 간식을 추천드려요
                </p>
              </div>
              {recommendations.length === 0 ? (
                <p className="lcc-empty">
                  현재 간식보다 낮은 1회 칼로리 항목이 목록에 없어요. 급여 횟수를 줄이거나
                  수의사와 상담해 보세요.
                </p>
              ) : (
                <ul className="lcc-grid">
                  {recommendations.map(function (snack) {
                    return (
                      <li className="lcc-card" key={snack.id}>
                        <p className="lcc-card-name">{snack.name}</p>
                        <p className="lcc-card-kcal">1회 {snack.kcal} kcal</p>
                        <p className="lcc-card-desc">{snack.desc}</p>
                        <button
                          type="button"
                          className="btn btn-lcc-sim"
                          onClick={function () {
                            self.handleCompare(snack);
                          }}
                        >
                          이 간식으로 시뮬레이션
                        </button>
                        <button
                          type="button"
                          className="btn btn-lcc-buy"
                          onClick={function () {
                            self.handleCardPurchase(snack);
                          }}
                        >
                          구매하기
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </div>

        {compareSimulation && compareSnack ? (
          <div className="cmp-results" role="region" aria-label="간식 비교 결과">
            <h3 className="cmp-results-title">간식 비교 결과</h3>
            <div className="cmp-row">
              <div
                className="cmp-card"
                style={{ borderColor: cmpTone(baseSim.status) }}
              >
                <p className="cmp-card-label">기존 간식</p>
                <p className="cmp-card-name">{selectedSnack.name}</p>
                <p className="cmp-card-kcal">1회 {selectedSnack.kcal} kcal</p>
                <p
                  className="cmp-card-metric"
                  style={{ color: cmpTone(baseSim.status) }}
                >
                  {baseWcLine}
                </p>
                <p
                  className="cmp-card-status"
                  style={{ color: cmpTone(baseSim.status) }}
                >
                  {baseSim.message}
                </p>
              </div>
              <div
                className="cmp-card"
                style={{ borderColor: cmpTone(compareSimulation.status) }}
              >
                <p className="cmp-card-label">저칼로리 간식</p>
                <p className="cmp-card-name">{compareSnack.name}</p>
                <p className="cmp-card-kcal">1회 {compareSnack.kcal} kcal</p>
                <p
                  className="cmp-card-metric"
                  style={{ color: cmpTone(compareSimulation.status) }}
                >
                  {formatWeightChangeHeadline(
                    compareSimulation.surplus,
                    compareSimulation.weightChange
                  )}
                </p>
                <p
                  className="cmp-card-status"
                  style={{ color: cmpTone(compareSimulation.status) }}
                >
                  {compareSimulation.message}
                </p>
              </div>
            </div>
            <p className="cmp-hint">
              오른쪽 수치가 더 유리하면 저칼로리 간식으로 바꿔 보는 것을 권장해요.
            </p>
            <button
              type="button"
              className="btn btn-cmp-clear"
              onClick={this.clearCompareResult}
            >
              비교 결과 지우기
            </button>
          </div>
        ) : null}

        <button
          type="button"
          className="btn btn-basis"
          onClick={onToggleBasis}
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
              <dd>{selectedSnack.kcal * 2} kcal/일</dd>
              <dt>초과 칼로리 (surplus)</dt>
              <dd>{surplusText} kcal/일</dd>
              <dt>30일 체중 변화 계산식</dt>
              <dd className="basis-formula">{formulaLine}</dd>
            </dl>
            <p className="basis-note">
              본 시뮬레이터는 교육용 단순 모델입니다. 질환·개체 차이는 반영되지 않으므로
              실제 급여는 수의사와 상담하세요.
            </p>
          </div>
        ) : null}
      </div>
    );
  }
}

class App extends Component {
  constructor(props) {
    super(props);
    let initialAuthenticated = false;
    try {
      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored === "true") {
          initialAuthenticated = true;
        }
      }
    } catch (e) {
      initialAuthenticated = false;
    }

    this.state = {
      isAuthenticated: initialAuthenticated,
      inputPassword: "",
      page: "main",
      photoPreview: null,
      photoName: "",
      age: "",
      weight: "",
      activity: "보통",
      /** 목표: 다이어트 시 lowCal 간식 위주 추천 */
      dietNeeded: false,
      /** getRecommended(snackList, userInfo) 결과 (최대 3개) */
      recommendedList: [],
      /** 클릭해 시뮬레이션 중인 간식 */
      selectedSnack: null,
      /** simulate(snackKcal) 결과 캐시 */
      simulationResult: null,
      /** 시뮬 surplus > 0일 때 저칼로리 대안 */
      alternatives: [],
      /** 선택 간식 시뮬의 계산 근거 토글 */
      basisOpenDetail: false,
    };
    this.fileInputRef = React.createRef();
    this.passwordInputRef = React.createRef();
    this.objectUrlRef = { current: null };
  }

  componentDidMount() {
    if (!this.state.isAuthenticated) {
      const inputEl = this.passwordInputRef.current;
      if (inputEl) {
        inputEl.focus();
      }
    }
  }

  componentWillUnmount() {
    if (this.objectUrlRef.current) {
      URL.revokeObjectURL(this.objectUrlRef.current);
      this.objectUrlRef.current = null;
    }
  }

  handlePickPhotoClick = () => {
    const input = this.fileInputRef.current;
    if (input) {
      input.click();
    }
  };

  handlePhotoChange = (e) => {
    const target = e.target;
    const files = target.files;
    if (!files || files.length === 0) {
      return;
    }
    const file = files[0];
    if (this.objectUrlRef.current) {
      URL.revokeObjectURL(this.objectUrlRef.current);
      this.objectUrlRef.current = null;
    }
    const url = URL.createObjectURL(file);
    this.objectUrlRef.current = url;
    this.setState({
      photoPreview: url,
      photoName: file.name,
    });
  };

  goToInput = () => {
    this.setState({
      page: "input",
      selectedSnack: null,
      simulationResult: null,
      alternatives: [],
      recommendedList: [],
      basisOpenDetail: false,
    });
  };

  goToMain = () => {
    this.setState({
      page: "main",
      selectedSnack: null,
      simulationResult: null,
      alternatives: [],
      recommendedList: [],
      basisOpenDetail: false,
    });
  };

  handleAgeChange = (e) => {
    this.setState({ age: e.target.value });
  };

  handleWeightChange = (e) => {
    this.setState({ weight: e.target.value });
  };

  handleActivityChange = (e) => {
    this.setState({ activity: e.target.value });
  };

  handleDietNeededChange = (e) => {
    this.setState({ dietNeeded: e.target.checked });
  };

  /**
   * 1회 kcal 기준 시뮬 (runSimulate 래핑)
   */
  simulate(snackKcal) {
    const w = this.parseWeightKg(this.state.weight);
    if (w === null) {
      return null;
    }
    return runSimulate(w, this.state.activity, snackKcal);
  }

  /** 추천 간식 선택 → 시뮬 실행 + surplus 시 저칼로리 대안 */
  selectRecommendedSnack = (snack) => {
    const sim = this.simulate(snack.kcal);
    let alts = [];
    if (sim && sim.surplus > 0) {
      alts = pickLowerCalorieSnacks(snack.kcal, snackList);
    }
    this.setState({
      selectedSnack: snack,
      simulationResult: sim,
      alternatives: alts,
      basisOpenDetail: false,
    });
  };

  /** 다른 추천 간식을 고를 때 */
  clearSnackSelection = () => {
    this.setState({
      selectedSnack: null,
      simulationResult: null,
      alternatives: [],
      basisOpenDetail: false,
    });
  };

  toggleBasisDetail = () => {
    this.setState(function (prev) {
      return { basisOpenDetail: !prev.basisOpenDetail };
    });
  };

  goToResult = () => {
    const userInfo = {
      weight: this.state.weight,
      activityLevel: this.state.activity,
      dietNeeded: this.state.dietNeeded,
    };
    const recommended = getRecommended(snackList, userInfo);
    this.setState({
      page: "result",
      recommendedList: recommended,
      selectedSnack: null,
      simulationResult: null,
      alternatives: [],
      basisOpenDetail: false,
    });
  };

  handleChange = (e) => {
    this.setState({
      inputPassword: e.target.value,
    });
  };

  handleLogin = () => {
    if (this.state.inputPassword === PASSWORD) {
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(AUTH_STORAGE_KEY, "true");
        }
      } catch (err) {
        // 저장 실패 시에도 화면 진입은 허용
      }
      this.setState({
        isAuthenticated: true,
        inputPassword: "",
      });
    } else {
      alert("비밀번호가 틀렸습니다.");
    }
  };

  /** 폼 제출(Enter) 시 로그인 */
  handleLoginSubmit = (e) => {
    e.preventDefault();
    this.handleLogin();
  };

  /**
   * 체중 문자열 검증 → kg 숫자 또는 null
   */
  parseWeightKg(weightStr) {
    if (weightStr === "" || weightStr === null || weightStr === undefined) {
      return null;
    }
    const n = parseFloat(weightStr);
    if (isNaN(n) || n <= 0) {
      return null;
    }
    return n;
  }

  renderMain() {
    const photoPreview = this.state.photoPreview;
    const photoName = this.state.photoName;
    const hasFile = Boolean(photoName);

    return (
      <div className="card">
        <div
          className={"upload-zone" + (hasFile ? " has-file" : "")}
        >
          <p className="upload-hint">
            강아지 사진을 올리면 더 맞춤형 안내를 드릴 수 있어요.
          </p>
          <input
            ref={this.fileInputRef}
            type="file"
            accept="image/*"
            className="hidden-input"
            onChange={this.handlePhotoChange}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={this.handlePickPhotoClick}
          >
            사진 업로드
          </button>
          {hasFile ? <p className="file-name">{photoName}</p> : null}
        </div>
        {photoPreview ? (
          <div className="preview-wrap">
            <img src={photoPreview} alt="업로드한 강아지" />
          </div>
        ) : null}
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={this.goToInput}
          >
            정보 입력하기
          </button>
        </div>
      </div>
    );
  }

  renderInput() {
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
              min="0"
              step="0.1"
              placeholder="예: 3"
              value={this.state.age}
              onChange={this.handleAgeChange}
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
              min="0"
              step="0.1"
              placeholder="예: 7.5"
              value={this.state.weight}
              onChange={this.handleWeightChange}
            />
          </div>
          <label className="card-label" htmlFor="dog-activity">
            활동량
          </label>
          <div className="field">
            <select
              id="dog-activity"
              className="select"
              value={this.state.activity}
              onChange={this.handleActivityChange}
            >
              <option value="낮음">낮음 (주로 실내) — 계수 1.2</option>
              <option value="보통">보통 (산책 1~2회) — 계수 1.6</option>
              <option value="높음">높음 (산책·놀이 많음) — 계수 2.0</option>
            </select>
          </div>
          <div className="field field-diet">
            <label className="diet-check-label">
              <input
                type="checkbox"
                className="diet-check-input"
                checked={this.state.dietNeeded}
                onChange={this.handleDietNeededChange}
              />
              <span>다이어트·체중 관리 필요 (저칼로리 간식 위주 추천)</span>
            </label>
          </div>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={this.goToResult}
          >
            추천 받기
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={this.goToMain}
          >
            이전
          </button>
        </div>
      </>
    );
  }

  renderLoginGate() {
    return (
      <div className="auth-gate">
        <div className="auth-card card">
          <h1 className="auth-title">접근 비밀번호 입력</h1>
          <p className="auth-hint">서비스를 이용하려면 비밀번호를 입력하세요.</p>
          <form className="auth-form" onSubmit={this.handleLoginSubmit} noValidate>
            <label className="card-label" htmlFor="app-password">
              비밀번호
            </label>
            <input
              id="app-password"
              ref={this.passwordInputRef}
              className="input auth-input"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="비밀번호"
              value={this.state.inputPassword}
              onChange={this.handleChange}
            />
            <button type="submit" className="btn btn-primary auth-submit">
              입장하기
            </button>
          </form>
        </div>
      </div>
    );
  }

  renderResult() {
    const age = this.state.age;
    const weight = this.state.weight;
    const activity = this.state.activity;
    const ageText = age ? age + "세" : "정보 미입력";
    const weightText = weight ? weight + "kg" : "정보 미입력";
    const dietNeeded = this.state.dietNeeded;
    const recommendedList = this.state.recommendedList;
    const selectedSnack = this.state.selectedSnack;
    const weightKg = this.parseWeightKg(this.state.weight);

    const self = this;

    let invalidReason = null;
    if (weightKg === null) {
      invalidReason =
        "시뮬레이션을 보려면 입력 화면에서 유효한 체중(kg)을 입력해 주세요.";
    }

    return (
      <>
        <div className="card">
          <p className="result-desc">
            <strong>{ageText}</strong>, 체중 <strong>{weightText}</strong>,
            활동량 <strong>{activity}</strong>
            {dietNeeded ? ", 다이어트 목표 반영" : ""} 기준 맞춤 추천이에요.
            간식을 선택하면 시뮬레이션이 열리고, 체중 증가 우려 시 저칼로리 대안이
            이어집니다.
          </p>
          <p className="result-flow-hint">
            추천 선택 → 시뮬레이션 → (증가 시) 저칼로리 대안 → 다시 선택
          </p>

          <div className="snack-grid">
            {recommendedList.map(function (item, index) {
              const isSelected = selectedSnack && selectedSnack.id === item.id;
              const blockClass = "snack-block" + (isSelected ? " snack-block--selected" : "");

              return (
                <div className={blockClass} key={item.id}>
                  <button
                    type="button"
                    className="snack-select-hit"
                    onClick={function () {
                      self.selectRecommendedSnack(item);
                    }}
                  >
                    <span className="snack-item">
                      <span className="snack-rank">{index + 1}</span>
                      <span className="snack-body">
                        <span className="snack-body-title">{item.name}</span>
                        <span className="snack-body-reason">{item.reason}</span>
                        <span className="snack-kcal">
                          1회 기준 약 <strong>{item.kcal}</strong> kcal
                          <span className="snack-kcal-note"> (하루 2회 가정)</span>
                        </span>
                      </span>
                    </span>
                  </button>
                  <p className="snack-tap-hint">탭하여 시뮬레이션</p>
                </div>
              );
            })}
          </div>

          {selectedSnack ? (
            <div className="sim-after-select">
              <div className="sim-after-select-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm-clear"
                  onClick={this.clearSnackSelection}
                >
                  다른 간식 선택
                </button>
              </div>
              <SnackSimulationExperience
                key={"sim-" + selectedSnack.id}
                invalidReason={invalidReason}
                weightKg={weightKg}
                activityLabel={activity}
                baseSnackId={selectedSnack.id}
                baseSnackName={selectedSnack.name}
                baseSnackKcal={selectedSnack.kcal}
                basisOpen={this.state.basisOpenDetail}
                onToggleBasis={this.toggleBasisDetail}
                alternativesOverride={
                  this.state.simulationResult && this.state.simulationResult.surplus > 0
                    ? this.state.alternatives
                    : undefined
                }
              />
            </div>
          ) : (
            <p className="select-snack-prompt">위 추천 중 하나를 눌러 시뮬레이션을 시작하세요.</p>
          )}
        </div>

        <div className="page-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={this.goToInput}
          >
            정보 수정
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={this.goToMain}
          >
            처음으로
          </button>
        </div>
      </>
    );
  }

  render() {
    if (!this.state.isAuthenticated) {
      return this.renderLoginGate();
    }

    const page = this.state.page;

    return (
      <div className="app">
        <header className="app-header">
          <h1 className="app-title">우리 강아지 맞춤 간식 추천</h1>
          {page === "main" ? null : (
            <p className="app-sub">
              {page === "input"
                ? "기본 정보를 입력해 주세요"
                : "추천 간식과 급여 시뮬레이션"}
            </p>
          )}
        </header>
        {page === "main"
          ? this.renderMain()
          : page === "input"
            ? this.renderInput()
            : this.renderResult()}
      </div>
    );
  }
}

export default App;
