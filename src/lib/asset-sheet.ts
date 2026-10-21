// 자산 현황 구글시트 바로가기 주소. 설정 화면에서 입력하고, 자산 화면의 [구글시트] 버튼이 연다.
// 이 앱은 로그인 없는 공개 사이트라 주소를 서버(환경변수·HTML)에 두면 방문자 누구나 링크를 보게 된다.
// 그래서 입력한 브라우저(기기)의 localStorage 에만 저장한다 — 기기마다 한 번씩 입력해야 한다.

import * as React from "react";

const KEY = "coss.assetSheetUrl";
const CHANGE_EVENT = "coss:asset-sheet-url";

/** 구글 도메인(docs/drive.google.com 등)의 https 주소만 허용하고 정규화한다. 아니면 null. */
export function normalizeSheetUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (u.hostname !== "google.com" && !u.hostname.endsWith(".google.com")) return null;
  return u.href;
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null; // 사생활 보호 모드 등에서 저장소 접근이 막힌 경우
  }
}

/** 주소 저장(null 이면 삭제). 저장소를 쓸 수 없으면 false. */
export function saveAssetSheetUrl(url: string | null): boolean {
  try {
    if (url) window.localStorage.setItem(KEY, url);
    else window.localStorage.removeItem(KEY);
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT)); // 같은 탭의 다른 화면 갱신(다른 탭은 storage 이벤트)
  return true;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** 저장된 시트 주소. 서버 렌더·하이드레이션 중엔 undefined(아직 모름), 없으면 null. */
export function useAssetSheetUrl(): string | null | undefined {
  const raw = React.useSyncExternalStore(subscribe, readRaw, () => undefined);
  if (raw === undefined) return undefined;
  return raw ? normalizeSheetUrl(raw) : null;
}
