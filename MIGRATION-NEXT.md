# Next.js App Router 마이그레이션 안내

## 로컬 실행

1. 의존성 설치: `npm install`
2. 개발 서버: `npm run dev` → 브라우저에서 [http://localhost:3000](http://localhost:3000)
3. 루트 `/`는 `/login`으로 리다이렉트됩니다. 데모 비밀번호는 기본값 `1234`입니다. 변경은 `.env.local`에 `NEXT_PUBLIC_APP_PASSWORD`를 설정하세요 (`.env.example` 참고).

## 플로우 URL (기존 단계와 대응)

| 단계 | 경로 |
|------|------|
| 로그인 | `/login` |
| 사진 | `/flow/photo` |
| 정보 입력 | `/flow/input` |
| 추천 | `/flow/recommend` |
| 시뮬레이션 | `/flow/simulation` |
| 저칼로리 대안 | `/flow/alternative` |

`/flow/*`는 클라이언트에서 로그인 여부를 확인한 뒤, 미인증이면 `/login`으로 보냅니다. `dogrecom_remember_auth` 로컬 스토리지 동작은 Vite 버전과 동일합니다.

## 프로덕션 빌드 확인

```bash
npm run build
npm run start
```

## Vercel 배포

- **Framework Preset**: Next.js (저장소 연결 시 자동 감지되는 경우가 많음).
- **Build Command**: `next build` (기본값).
- **Output**: Next 기본 출력 (이전 SPA용 `vercel.json` rewrites는 제거됨).
- 환경 변수: 필요 시 `NEXT_PUBLIC_APP_PASSWORD`를 프로젝트 설정에 추가.

## 구조 요약

- **Server Components**: `app/**/page.tsx`, `app/layout.tsx`, `app/flow/layout.tsx`는 서버 컴포넌트이며, 상호작용·상태는 `components/`의 `"use client"` 모듈에 위임합니다.
- **공유 로직**: `lib/snacks.ts`, `lib/simulation.ts`, `lib/auth-constants.ts` (서버/클라이언트 공용).
- **스타일**: `app/globals.css`(Tailwind + 전역 리셋) + `styles/legacy.css`(기존 `App.css`).
