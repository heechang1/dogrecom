"use client";

import Link from "next/link";
import { useDogApp } from "@/components/dog-app-context";

export function PhotoStep() {
  const {
    photoPreview,
    photoName,
    setPhotoFromFile,
    triggerPickPhoto,
    fileInputRef,
    goToInput,
  } = useDogApp();

  const hasFile = Boolean(photoName);

  return (
    <div className="card">
      <div className="mb-4">
        <Link
          href="/feed/scan"
          className="btn btn-primary w-full py-3 text-center no-underline block rounded-xl font-semibold shadow-sm"
        >
          급여 기록 등록하기
        </Link>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden-input"
        onChange={(e) => {
          const files = e.target.files;
          if (!files || files.length === 0) return;
          setPhotoFromFile(files[0]);
        }}
      />
      <div className={"upload-zone" + (hasFile ? " has-file" : "")}>
        <p className="upload-hint">
          강아지 사진을 올리면 더 맞춤형 안내를 드릴 수 있어요.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => triggerPickPhoto()}
        >
          사진 업로드
        </button>
        {hasFile ? <p className="file-name">{photoName}</p> : null}
      </div>
      {photoPreview ? (
        <div className="preview-wrap">
          {/* 로컬 object URL 미리보기 — next/image 대상 아님 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoPreview} alt="업로드한 강아지" />
        </div>
      ) : null}
      <div className="page-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => goToInput()}
        >
          정보 입력하기
        </button>
      </div>
    </div>
  );
}
