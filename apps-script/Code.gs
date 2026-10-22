/**
 * COSS자산관리 — Google Sheets 백엔드 (Apps Script 웹앱)
 *
 * 설치
 *  1) 데이터용 Google Sheet 를 하나 만든다.
 *  2) 확장 프로그램 > Apps Script 를 열고, 이 파일 내용을 전부 붙여넣는다.
 *  3) 톱니(프로젝트 설정) > 스크립트 속성 > 속성 추가: 이름 TOKEN, 값 <임의의 긴 문자열>
 *  4) 상단 함수 목록에서 setup 을 한 번 실행(권한 승인) → 탭/헤더가 생성된다.
 *  5) 배포 > 새 배포 > 유형 '웹 앱' > 실행 '나', 액세스 '모든 사용자' > 배포 → 웹앱 URL 복사.
 *  6) Vercel 환경변수: SHEETS_API_URL=<웹앱 URL>, SHEETS_API_TOKEN=<위 TOKEN 값>
 *
 * 토큰이 맞는 요청만 통과하므로, URL/토큰을 모르면 데이터에 접근할 수 없다.
 */

const SCHEMA = {
  assets:      ["id","mgmtNo","tagNo","itemName","spec","category","status","user","location","unitPrice","acquiredAt","memo","updatedAt"],
  loans:       ["id","mgmtNo","itemName","borrower","affiliation","phone","reason","loanedAt","dueAt","returnedAt","status","manager","updatedAt"],
  consumables: ["id","itemName","spec","unit","qty","safetyQty","location","updatedAt"],
  promo:       ["id","code","name","unit","qty","safetyQty","note","updatedAt"],
};

function tokenOk_(t) {
  var want = PropertiesService.getScriptProperties().getProperty("TOKEN") || "";
  return want && String(t) === want;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheetFor_(tab) {
  var headers = SCHEMA[tab];
  if (!headers) throw new Error("알 수 없는 탭: " + tab);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(tab) || ss.insertSheet(tab);
  // 데이터 행이 없으면(헤더만/빈 탭) 헤더를 스키마에 맞춰 (재)설정 → 스키마 변경 자동 반영.
  // 데이터가 있으면 손대지 않는다(열 어긋남 방지).
  if (sh.getLastRow() <= 1) {
    sh.clear();
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function readAll_(tab) {
  var headers = SCHEMA[tab];
  var sh = sheetFor_(tab);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, headers.length).getValues();
  var tz = Session.getScriptTimeZone();
  return values
    .map(function (row) {
      var o = {};
      headers.forEach(function (h, i) {
        var v = row[i];
        o[h] = (v instanceof Date) ? Utilities.formatDate(v, tz, "yyyy-MM-dd") : v;
      });
      return o;
    })
    .filter(function (o) {
      return headers.some(function (h) { return String(o[h] || "").length > 0; });
    });
}

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (!tokenOk_(p.token)) return json_({ error: "unauthorized" });
    if (!SCHEMA[p.tab]) return json_({ error: "unknown tab" });
    return json_(readAll_(p.tab));
  } catch (err) {
    return json_({ error: String(err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (!tokenOk_(body.token)) return json_({ ok: false, error: "unauthorized" });
    var headers = SCHEMA[body.tab];
    if (!headers) return json_({ ok: false, error: "unknown tab" });
    var action = body.action;
    var row = body.row || {};
    var sh = sheetFor_(body.tab);

    if (action === "append") {
      row.id = row.id || Utilities.getUuid().slice(0, 8);
      row.updatedAt = new Date().toISOString();
      sh.appendRow(headers.map(function (h) { return row[h] != null ? row[h] : ""; }));
      return json_({ ok: true, id: row.id });
    }

    if (action === "update" || action === "delete") {
      if (!row.id) return json_({ ok: false, error: "id 필요" });
      var last = sh.getLastRow();
      if (last < 2) return json_({ ok: false, error: "대상 없음" });
      var idCol = headers.indexOf("id") + 1;
      var ids = sh.getRange(2, idCol, last - 1, 1).getValues();
      var target = -1;
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(row.id)) { target = i + 2; break; }
      }
      if (target < 0) return json_({ ok: false, error: "대상 없음" });
      if (action === "delete") { sh.deleteRow(target); return json_({ ok: true }); }
      row.updatedAt = new Date().toISOString();
      var cur = sh.getRange(target, 1, 1, headers.length).getValues()[0];
      var merged = headers.map(function (h, i) { return row[h] != null ? row[h] : cur[i]; });
      sh.getRange(target, 1, 1, headers.length).setValues([merged]);
      return json_({ ok: true });
    }

    return json_({ ok: false, error: "알 수 없는 action" });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/** 최초 1회 실행: 탭/헤더 생성. */
function setup() {
  Object.keys(SCHEMA).forEach(function (tab) { sheetFor_(tab); });
}
