"use client";

import { useDogApp } from "@/components/dog-app-context";

export function ResultFooter() {
  const { goToInput, goToPhoto } = useDogApp();
  return (
    <div className="page-actions page-actions--flow">
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => goToInput()}
      >
        정보 수정
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => goToPhoto()}
      >
        처음으로
      </button>
    </div>
  );
}
