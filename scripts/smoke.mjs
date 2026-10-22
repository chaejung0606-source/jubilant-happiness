// 배포 전 스모크 QA — 프로덕션 서버를 띄워 모든 화면이 200으로 뜨고
// 치명 에러 마커가 없는지 확인한다. (npm run build 이후 실행)
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";

const PORT = Number(process.env.SMOKE_PORT || 3999);
const BASE = `http://127.0.0.1:${PORT}`;
const ROUTES = ["/", "/assets", "/reconcile", "/loans", "/consumables", "/promo", "/settings"];
const ERR = /Application error|Internal Server Error|__next_error__|TypeError:|ReferenceError:/i;

const isWin = process.platform === "win32";
const bin = path.join("node_modules", ".bin", isWin ? "next.cmd" : "next");
const server = spawn(bin, ["start", "-p", String(PORT)], { stdio: "ignore", shell: isWin });

let failed = 0;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(BASE + "/"); if (r.ok) { ready = true; break; } } catch { /* 대기 */ }
    await sleep(500);
  }
  if (!ready) { console.error("FAIL  서버가 뜨지 않음"); process.exit(1); }

  for (const route of ROUTES) {
    let ok = false, note = "";
    try {
      const res = await fetch(BASE + route);
      const body = await res.text();
      const bad = ERR.test(body);
      ok = res.status === 200 && !bad;
      note = `HTTP ${res.status}${bad ? " +에러마커" : ""}`;
    } catch (e) {
      note = String(e);
    }
    console.log(`${ok ? "PASS" : "FAIL"}  ${route.padEnd(14)} ${note}`);
    if (!ok) failed++;
  }
} finally {
  server.kill("SIGTERM");
}

const total = ROUTES.length;
console.log(`\n스모크: ${total - failed}/${total} PASS`);
process.exit(failed ? 1 : 0);
