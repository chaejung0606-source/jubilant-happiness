"use client";

import { useEffect } from "react";

/**
 * PWA 서비스워커 등록 (프로덕션에서만).
 * 데스크톱/갤럭시 태블릿 Chrome에서 "앱 설치"가 뜨도록 /sw.js 를 등록한다.
 * 개발 중에는 캐시 혼선을 막기 위해 등록하지 않는다.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* 등록 실패는 조용히 무시 — 앱 동작에는 지장 없음 */
      });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
