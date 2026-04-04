/** 앱 전체 접근용 비밀번호 (데모용 — 운영 시 서버 인증으로 교체 권장) */
export const PASSWORD =
  process.env.NEXT_PUBLIC_APP_PASSWORD !== undefined &&
  process.env.NEXT_PUBLIC_APP_PASSWORD !== ""
    ? process.env.NEXT_PUBLIC_APP_PASSWORD
    : "1234";

export const AUTH_STORAGE_KEY = "dogrecom_remember_auth";

/** 구버전 키 — 마이그레이션 시 제거 */
export const AUTH_LEGACY_KEY = "auth";
