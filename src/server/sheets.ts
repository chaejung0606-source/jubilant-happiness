// Google Sheets 백엔드 클라이언트 (서버 전용).
// Apps Script 웹앱 엔드포인트와 통신한다. 환경변수가 없으면 미설정으로 간주.
//   SHEETS_API_URL   — Apps Script 웹앱 배포 URL
//   SHEETS_API_TOKEN — 간단한 공유 토큰 (Apps Script 스크립트 속성 TOKEN 과 동일)

const BASE = process.env.SHEETS_API_URL;
const TOKEN = process.env.SHEETS_API_TOKEN ?? "";

export function sheetsConfigured(): boolean {
  return !!BASE;
}

export type SheetTab = "assets" | "loans" | "consumables" | "promo" | "accounts";

export interface SheetMeta {
  url: string;
  gids: Partial<Record<SheetTab, number>>;
}

/** 연결된 스프레드시트 주소·탭 gid(Apps Script `meta`). 구버전 Code.gs 라 응답에 없으면 null. */
export async function sheetMeta(): Promise<SheetMeta | null> {
  if (!BASE) throw new Error("SHEETS_API_URL 미설정");
  const url = `${BASE}?token=${encodeURIComponent(TOKEN)}&meta=1`;
  // 시트 주소는 거의 바뀌지 않으므로 10분 캐시. Code.gs 재배포 후 최대 10분 안에 반영된다.
  const res = await fetch(url, { next: { revalidate: 600, tags: ["sheets"] } });
  if (!res.ok) throw new Error(`시트 정보 읽기 실패: HTTP ${res.status}`);
  const data = await res.json();
  if (!data || typeof data.url !== "string") return null;
  return { url: data.url, gids: data.gids && typeof data.gids === "object" ? data.gids : {} };
}

/** 탭 전체 행을 객체 배열로 읽는다. */
export async function sheetGet(tab: SheetTab): Promise<Record<string, unknown>[]> {
  if (!BASE) throw new Error("SHEETS_API_URL 미설정");
  const url = `${BASE}?token=${encodeURIComponent(TOKEN)}&tab=${encodeURIComponent(tab)}`;
  // 30초 캐시(ISR) + 'sheets' 태그 — 메뉴 이동마다 Apps Script를 재호출하지 않음.
  // 쓰기 시 revalidateTag("sheets")로 즉시 무효화한다.
  const res = await fetch(url, { next: { revalidate: 30, tags: ["sheets"] } });
  if (!res.ok) throw new Error(`시트 읽기 실패(${tab}): HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error((data && data.error) || "시트 응답 형식 오류");
  return data as Record<string, unknown>[];
}

type WriteAction = "append" | "update" | "delete";

/** 탭에 쓰기(추가/수정/삭제). */
export async function sheetWrite(
  tab: SheetTab,
  action: WriteAction,
  row: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!BASE) throw new Error("SHEETS_API_URL 미설정");
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: TOKEN, tab, action, row }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || `시트 쓰기 실패: HTTP ${res.status}`);
  }
  return data;
}
