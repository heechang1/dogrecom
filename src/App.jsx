import React, { Component } from "react";
import "./App.css";

/** 앱 전체 접근용 비밀번호 (데모용 — 운영 시 서버 인증으로 교체 권장) */
const PASSWORD = "1234";

/**
 * 로그인 유지용 키 (도메인 전용).
 * 예전 키 "auth"는 다른 사이트/테스트와 겹칠 수 있어 사용하지 않음.
 */
const AUTH_STORAGE_KEY = "dogrecom_remember_auth";

/** 구버전 키 — 마이그레이션 시 제거 */
const AUTH_LEGACY_KEY = "auth";

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

/** 플로우 단계: 한 화면에 한 행동 */
const VIEW_RECOMMEND = "RECOMMEND";
const VIEW_SIMULATION = "SIMULATION";
const VIEW_ALTERNATIVE = "ALTERNATIVE";

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
      /** 체크 시에만 localStorage에 로그인 유지 저장 */
      rememberLogin: false,
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
      /** 결과 화면 플로우 단계 */
      viewStep: VIEW_RECOMMEND,
    };
    this.fileInputRef = React.createRef();
    this.passwordInputRef = React.createRef();
    this.objectUrlRef = { current: null };
  }

  componentDidMount() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(AUTH_LEGACY_KEY);
      }
    } catch (e) {
      // ignore
    }

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
      viewStep: VIEW_RECOMMEND,
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
      viewStep: VIEW_RECOMMEND,
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

  /** 1) 추천 → 시뮬 화면 */
  handleSelectSnack = (snack) => {
    const result = this.simulate(snack.kcal);
    this.setState({
      selectedSnack: snack,
      simulationResult: result,
      viewStep: VIEW_SIMULATION,
      alternatives: [],
      basisOpenDetail: false,
    });
  };

  /** 2) 시뮬 → 저칼로리 목록 화면 (surplus > 0 일 때) */
  handleShowAlternative = () => {
    const snack = this.state.selectedSnack;
    if (!snack) {
      return;
    }
    const alternatives = pickLowerCalorieSnacks(snack.kcal, snackList);
    this.setState({
      alternatives: alternatives,
      viewStep: VIEW_ALTERNATIVE,
    });
  };

  /** 3) 대안 간식 선택 → 다시 시뮬 화면 */
  handleSelectAlternative = (snack) => {
    const result = this.simulate(snack.kcal);
    this.setState({
      selectedSnack: snack,
      simulationResult: result,
      viewStep: VIEW_SIMULATION,
      alternatives: [],
      basisOpenDetail: false,
    });
  };

  /** 플로우 뒤로가기 */
  handleFlowBack = () => {
    const step = this.state.viewStep;
    if (step === VIEW_SIMULATION) {
      this.setState({
        viewStep: VIEW_RECOMMEND,
        selectedSnack: null,
        simulationResult: null,
        alternatives: [],
        basisOpenDetail: false,
      });
    } else if (step === VIEW_ALTERNATIVE) {
      this.setState({ viewStep: VIEW_SIMULATION });
    }
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
      viewStep: VIEW_RECOMMEND,
    });
  };

  handleChange = (e) => {
    this.setState({
      inputPassword: e.target.value,
    });
  };

  handleRememberLoginChange = (e) => {
    this.setState({ rememberLogin: e.target.checked });
  };

  handleLogin = () => {
    if (this.state.inputPassword === PASSWORD) {
      try {
        if (typeof localStorage !== "undefined") {
          if (this.state.rememberLogin) {
            localStorage.setItem(AUTH_STORAGE_KEY, "true");
          } else {
            localStorage.removeItem(AUTH_STORAGE_KEY);
          }
        }
      } catch (err) {
        // 저장 실패 시에도 화면 진입은 허용
      }
      this.setState({
        isAuthenticated: true,
        inputPassword: "",
        rememberLogin: false,
      });
    } else {
      alert("비밀번호가 틀렸습니다.");
    }
  };

  /** 로그아웃 → 비밀번호 화면으로 (저장된 자동 로그인도 해제) */
  handleLogout = () => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem(AUTH_LEGACY_KEY);
      }
    } catch (e) {
      // ignore
    }
    this.setState({
      isAuthenticated: false,
      inputPassword: "",
      rememberLogin: false,
      page: "main",
      viewStep: VIEW_RECOMMEND,
      selectedSnack: null,
      simulationResult: null,
      alternatives: [],
      recommendedList: [],
    });
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
            <label className="auth-remember-label">
              <input
                type="checkbox"
                className="auth-remember-input"
                checked={this.state.rememberLogin}
                onChange={this.handleRememberLoginChange}
              />
              <span>이 브라우저에서 로그인 유지 (다음 접속 시 비밀번호 생략)</span>
            </label>
            <button type="submit" className="btn btn-primary auth-submit">
              입장하기
            </button>
          </form>
        </div>
      </div>
    );
  }

  /** 플로우 하단 공통 (입력·메인 이동) */
  renderResultFooter() {
    return (
      <div className="page-actions page-actions--flow">
        <button type="button" className="btn btn-secondary" onClick={this.goToInput}>
          정보 수정
        </button>
        <button type="button" className="btn btn-ghost" onClick={this.goToMain}>
          처음으로
        </button>
      </div>
    );
  }

  /** 단계 1: 추천 3개 — 탭하면 시뮬 단계로 */
  renderRecommend() {
    const age = this.state.age;
    const weight = this.state.weight;
    const activity = this.state.activity;
    const ageText = age ? age + "세" : "정보 미입력";
    const weightText = weight ? weight + "kg" : "정보 미입력";
    const dietNeeded = this.state.dietNeeded;
    const recommendedList = this.state.recommendedList;
    const self = this;

    return (
      <>
        <div className="card flow-card">
          <p className="flow-step-badge">1 / 3 · 추천</p>
          <p className="result-desc">
            <strong>{ageText}</strong>, 체중 <strong>{weightText}</strong>,
            활동량 <strong>{activity}</strong>
            {dietNeeded ? ", 다이어트 목표 반영" : ""} 기준으로 골랐어요.
          </p>
          <p className="flow-one-action-hint">
            한 화면에서 한 가지: 아래 간식 중 <strong>하나를 탭</strong>하면 시뮬 화면으로 넘어갑니다.
          </p>

          <div className="snack-grid">
            {recommendedList.map(function (item, index) {
              return (
                <div className="snack-block" key={item.id}>
                  <button
                    type="button"
                    className="snack-select-hit"
                    onClick={function () {
                      self.handleSelectSnack(item);
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
                </div>
              );
            })}
          </div>
        </div>
        {this.renderResultFooter()}
      </>
    );
  }

  handlePurchasePlaceholder = () => {};

  /** 단계 2: 시뮬 결과 — 증가 시 대안 화면으로 이동 CTA */
  renderSimulation() {
    const weightKg = this.parseWeightKg(this.state.weight);
    const activity = this.state.activity;
    const snack = this.state.selectedSnack;
    const sim = this.state.simulationResult;
    const basisOpen = this.state.basisOpenDetail;

    let invalidReason = null;
    if (weightKg === null) {
      invalidReason =
        "시뮬레이션을 보려면 입력 화면에서 유효한 체중(kg)을 입력해 주세요.";
    }

    if (!snack) {
      return (
        <>
          <div className="card flow-card">
            <p className="flow-step-badge">2 / 3 · 시뮬레이션</p>
            <p className="sim-invalid">선택된 간식이 없습니다. 추천 화면으로 돌아가 주세요.</p>
            <button type="button" className="btn btn-primary flow-cta-full" onClick={this.handleFlowBack}>
              추천으로 돌아가기
            </button>
          </div>
          {this.renderResultFooter()}
        </>
      );
    }

    if (invalidReason) {
      return (
        <>
          <button type="button" className="btn-flow-back" onClick={this.handleFlowBack}>
            ← 추천으로
          </button>
          <div className="card flow-card">
            <p className="flow-step-badge">2 / 3 · 시뮬레이션</p>
            <div className="sim-card sim-card--muted">
              <p className="sim-invalid">{invalidReason}</p>
            </div>
            <button type="button" className="btn btn-primary flow-cta-full" onClick={this.goToInput}>
              입력하러 가기
            </button>
          </div>
          {this.renderResultFooter()}
        </>
      );
    }

    if (!sim) {
      return (
        <>
          <button type="button" className="btn-flow-back" onClick={this.handleFlowBack}>
            ← 추천으로
          </button>
          <div className="card flow-card">
            <p className="flow-step-badge">2 / 3 · 시뮬레이션</p>
            <p className="sim-invalid">시뮬레이션을 계산할 수 없습니다.</p>
          </div>
          {this.renderResultFooter()}
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
        <button type="button" className="btn-flow-back" onClick={this.handleFlowBack}>
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
                <p className="gain-ux-line gain-ux-line--warn">⚠️ 체중 증가 위험이 있어요</p>
                <p className="gain-ux-line gain-ux-line--tip">👉 하루 1회로 줄이세요</p>
                <button
                  type="button"
                  className="btn btn-primary flow-cta-full"
                  onClick={this.handleShowAlternative}
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
                  onClick={this.handleFlowBack}
                >
                  다른 추천 간식 고르기
                </button>
              </div>
            )}

            <button
              type="button"
              className="btn btn-secondary flow-cta-secondary"
              onClick={this.handlePurchasePlaceholder}
            >
              그래도 구매하기
            </button>

            <button
              type="button"
              className="btn btn-basis"
              onClick={this.toggleBasisDetail}
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
                  본 시뮬레이터는 교육용 단순 모델입니다. 질환·개체 차이는 반영되지 않으므로
                  실제 급여는 수의사와 상담하세요.
                </p>
              </div>
            ) : null}
          </div>
        </div>
        {this.renderResultFooter()}
      </>
    );
  }

  /** 단계 3: 저칼로리 대안 — 선택 시 다시 시뮬 */
  renderAlternative() {
    const alternatives = this.state.alternatives;
    const self = this;

    return (
      <>
        <button type="button" className="btn-flow-back" onClick={this.handleFlowBack}>
          ← 시뮬레이션으로
        </button>
        <div className="card flow-card">
          <p className="flow-step-badge">3 / 3 · 저칼로리 대안</p>
          <p className="flow-one-action-hint">
            현재 간식보다 1회 칼로리가 낮은 항목입니다. 하나를 고르면 시뮬 화면으로 돌아갑니다.
          </p>

          {alternatives.length === 0 ? (
            <>
              <p className="lcc-empty">더 낮은 칼로리 간식이 목록에 없어요.</p>
              <button
                type="button"
                className="btn btn-primary flow-cta-full"
                onClick={this.handleFlowBack}
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
                        self.handleSelectAlternative(item);
                      }}
                    >
                      이 간식으로 시뮬레이션
                    </button>
                    <button
                      type="button"
                      className="btn btn-lcc-buy"
                      onClick={self.handlePurchasePlaceholder}
                    >
                      구매하기
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {this.renderResultFooter()}
      </>
    );
  }

  renderResult() {
    const step = this.state.viewStep;
    if (step === VIEW_RECOMMEND) {
      return this.renderRecommend();
    }
    if (step === VIEW_SIMULATION) {
      return this.renderSimulation();
    }
    if (step === VIEW_ALTERNATIVE) {
      return this.renderAlternative();
    }
    return this.renderRecommend();
  }

  render() {
    if (!this.state.isAuthenticated) {
      return this.renderLoginGate();
    }

    const page = this.state.page;

    return (
      <div className="app">
        <header className="app-header">
          <div className="app-header-row">
            <h1 className="app-title">우리 강아지 맞춤 간식 추천</h1>
            <button
              type="button"
              className="btn-app-logout"
              onClick={this.handleLogout}
            >
              로그아웃
            </button>
          </div>
          {page === "main" ? null : (
            <p className="app-sub">
              {page === "input"
                ? "기본 정보를 입력해 주세요"
                : this.state.viewStep === VIEW_RECOMMEND
                  ? "1단계: 맞춤 추천 선택"
                  : this.state.viewStep === VIEW_SIMULATION
                    ? "2단계: 급여 시뮬레이션"
                    : "3단계: 저칼로리 대안"}
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
