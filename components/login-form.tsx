"use client";

import { useEffect, useRef, useState } from "react";
import { useDogApp } from "@/components/dog-app-context";

export function LoginForm() {
  const { login, authReady, isAuthenticated } = useDogApp();
  const [password, setPassword] = useState("");
  const [rememberLogin, setRememberLogin] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!authReady || isAuthenticated) return;
    passwordInputRef.current?.focus();
  }, [authReady, isAuthenticated]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = login(password, rememberLogin);
    if (!ok) {
      alert("비밀번호가 틀렸습니다.");
    }
  }

  if (!authReady) {
    return (
      <div className="auth-gate">
        <div className="auth-card card">
          <p className="auth-hint">불러오는 중…</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="auth-gate">
      <div className="auth-card card">
        <h1 className="auth-title">접근 비밀번호 입력</h1>
        <p className="auth-hint">서비스를 이용하려면 비밀번호를 입력하세요.</p>
        <form
          className="auth-form"
          onSubmit={handleSubmit}
          noValidate
        >
          <label className="card-label" htmlFor="app-password">
            비밀번호
          </label>
          <input
            id="app-password"
            ref={passwordInputRef}
            className="input auth-input"
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <label className="auth-remember-label">
            <input
              type="checkbox"
              className="auth-remember-input"
              checked={rememberLogin}
              onChange={(e) => setRememberLogin(e.target.checked)}
            />
            <span>
              이 브라우저에서 로그인 유지 (다음 접속 시 비밀번호 생략)
            </span>
          </label>
          <button type="submit" className="btn btn-primary auth-submit">
            입장하기
          </button>
        </form>
      </div>
    </div>
  );
}
