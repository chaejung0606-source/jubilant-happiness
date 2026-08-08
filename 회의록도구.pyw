# -*- coding: utf-8 -*-
"""
회의록 자동 작성 도구 (GUI)
- 회의 폴더를 추가/드래그하면, 폴더마다 회의록 1건을 만들어 출력 폴더에 저장합니다.
- 결과물은 사업단 표준 양식의 .docx 문서(한글/워드에서 열림)로 저장됩니다.
- API 키 없이, 이 PC에 로그인된 Claude(Max 구독)로 동작합니다. (claude CLI 사용)
"""
import os
import re
import sys
import glob
import json
import queue
import shutil
import zipfile
import datetime
import tempfile
import threading
import traceback
import subprocess
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

# 드래그&드롭(선택): tkinterdnd2 가 있으면 사용, 없으면 버튼으로만
try:
    from tkinterdnd2 import TkinterDnD, DND_FILES
    HAS_DND = True
except Exception:
    HAS_DND = False

FONT = "맑은 고딕"
# 양식 고정값
HEADER_TITLE = "데이터보안·활용 융합 혁신융합대학사업단 회의록"
PROJECT_NAME = "첨단분야 혁신 융합대학 (데이터보안·활용융합)"
DEFAULT_ORG = "강원대학교"

# 회의 1건당 최대 대기 시간(초)
TIMEOUT_SEC = 1800


# ---- 오류 기록 (.pyw 는 콘솔이 없어서 오류가 보이지 않으므로 파일로 남긴다) ----
def _app_dir():
    # .exe 로 묶인 경우 __file__ 은 임시 폴더를 가리키므로 실행 파일 위치를 쓴다.
    if getattr(sys, "frozen", False):
        return os.path.dirname(os.path.abspath(sys.executable))
    try:
        return os.path.dirname(os.path.abspath(__file__))
    except Exception:
        return os.path.dirname(os.path.abspath(sys.argv[0]))


def _resource_dir():
    """PyInstaller 로 묶였을 때 아이콘 등 포함 자원이 풀리는 위치."""
    return getattr(sys, "_MEIPASS", None) or _app_dir()


def _log_path():
    d = _app_dir()
    if not os.access(d, os.W_OK):
        d = tempfile.gettempdir()
    return os.path.join(d, "오류기록.txt")


def log(msg):
    try:
        stamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(_log_path(), "a", encoding="utf-8") as f:
            f.write("[%s] %s\n" % (stamp, msg))
    except Exception:
        pass


def _excepthook(etype, value, tb):
    text = "".join(traceback.format_exception(etype, value, tb))
    log("처리되지 않은 오류\n" + text)
    try:
        messagebox.showerror(
            "오류",
            "예상치 못한 오류가 발생했습니다.\n\n%s: %s\n\n자세한 내용은 아래 파일에 기록했습니다.\n%s"
            % (etype.__name__, str(value)[:200], _log_path()))
    except Exception:
        pass


sys.excepthook = _excepthook

if hasattr(threading, "excepthook"):
    def _thread_excepthook(args):
        log("작업 스레드 오류\n" + "".join(traceback.format_exception(
            args.exc_type, args.exc_value, args.exc_traceback)))
    threading.excepthook = _thread_excepthook


# ---- claude CLI 위치 자동 탐색 ----
def find_claude():
    """claude 실행 파일 경로를 찾는다. .exe 뿐 아니라 npm 설치본(.cmd)도 찾는다."""
    # 1) PATH 탐색. shutil.which 는 PATHEXT 를 적용하므로 claude.cmd 도 잡힌다.
    found = shutil.which("claude")
    if found:
        return found
    # 2) 알려진 설치 위치
    home = os.path.expanduser("~")
    appdata = os.environ.get("APPDATA", "")
    localappdata = os.environ.get("LOCALAPPDATA", "")
    candidates = [
        os.path.join(home, ".local", "bin", "claude.exe"),
        os.path.join(home, ".local", "bin", "claude"),
        os.path.join(localappdata, "Programs", "claude", "claude.exe"),
        os.path.join(appdata, "npm", "claude.cmd"),
        os.path.join(appdata, "npm", "claude"),
    ]
    for c in candidates:
        if c and os.path.exists(c):
            return c
    return ""


def claude_command(exe, cli_args):
    """.cmd/.bat 은 CreateProcess 로 직접 실행할 수 없으므로 cmd.exe 로 감싼다."""
    if os.name == "nt" and exe.lower().endswith((".cmd", ".bat")):
        return ["cmd.exe", "/d", "/c", exe] + cli_args
    return [exe] + cli_args


def _run_kwargs(cwd, timeout):
    kwargs = dict(cwd=cwd, capture_output=True, text=True,
                  encoding="utf-8", errors="replace", timeout=timeout,
                  stdin=subprocess.DEVNULL)
    if os.name == "nt":
        kwargs["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    return kwargs


LOGIN_HELP = (
    "Claude 에 로그인되어 있지 않습니다.\n\n"
    "아래 순서로 한 번만 로그인하면 됩니다.\n\n"
    "  1. 시작 메뉴에서 '명령 프롬프트' 를 엽니다.\n"
    "  2. claude  를 입력하고 Enter 를 누릅니다.\n"
    "  3. 안내에 따라 로그인합니다. (브라우저가 열립니다)\n"
    "  4. 로그인이 끝나면 이 프로그램에서 [작업 시작] 을 다시 누릅니다.\n\n"
    "이미 로그인했는데도 이 메시지가 보이면, 명령 프롬프트에서\n"
    "claude auth status  를 실행해 결과를 확인해 주세요."
)


def check_claude():
    """실행 전 점검. (사용 가능하면 (True, 버전문자열))"""
    exe = find_claude()
    if not exe:
        return (False, "claude 명령을 찾을 수 없습니다.\n\n"
                       "Claude Code 를 설치한 뒤 컴퓨터를 다시 시작하거나,\n"
                       "명령 프롬프트에서 'claude --version' 이 동작하는지 확인해 주세요.")
    try:
        r = subprocess.run(claude_command(exe, ["--version"]), **_run_kwargs(None, 60))
    except Exception as e:
        return (False, "claude 실행에 실패했습니다.\n\n%s\n%s" % (exe, e))
    if r.returncode != 0:
        return (False, "claude 실행에 실패했습니다.\n\n%s\n%s"
                % (exe, (r.stderr or r.stdout or "").strip()[:300]))
    version = (r.stdout or "").strip()

    # 설치되어 있어도 로그인이 안 되어 있으면 회의록을 한 건도 만들 수 없다.
    try:
        a = subprocess.run(claude_command(exe, ["auth", "status", "--json"]),
                           **_run_kwargs(None, 60))
        info = _extract_json(a.stdout)
        if isinstance(info, dict) and info.get("loggedIn") is False:
            return (False, LOGIN_HELP)
    except Exception:
        pass        # 예전 버전이라 auth 명령이 없으면 그냥 넘어간다
    return (True, version)


# ---- 회의록 작성 규칙 (여기만 고치면 문체/판단 기준이 바뀝니다) ----
RULES = """- 회의는 끝난 뒤 작성하는 문서이므로 완료·과거 관점으로 작성.
- 회의안건(agenda): 서류(공문·계획서 등)에 나타난 회의 안건.
- 회의일시(date): 'YYYY. M. D. (요일) HH:MM ~ HH:MM' 형식. 종료 시각을 모르면 시작 시각 + 1시간.
- 회의장소(place): 회의/행사가 실제 진행된 장소.
- 회의비 사용처(expensePlace): 영수증에 찍힌 가맹점(상호)명.
- 금액(amount): 영수증 결제 합계 금액(예: '120,000원'). 여러 영수증이면 합산.
- 참석자(attendees): 참석 서명부에 실제로 서명한 사람만 넣는다. 각 항목은 {"org":"소속","name":"이름"} 객체. 소속을 알 수 없으면 org 를 '강원대학교'로 둔다. 서명부가 없거나 서명자를 알 수 없으면 빈 배열. 추측 금지.
- 회의내용(content): 서류를 바탕으로 반드시 최소 2문단, 최대 3문단으로 충실하게 작성한다. 배열의 각 원소가 한 문단이며, content 배열 길이는 2 또는 3이어야 한다. 각 문단은 4~5개의 문장(약 4~5줄 분량)으로 구성하고 명사체(…함/…임/…음)로 서술한다. 한두 줄로 짧게 끝내지 말고, 논의된 안건·검토사항·추진방향·후속조치 등을 구체적으로 풀어 서술한다. 개조식(항목 나열)으로 쓰지 말고 문단형 서술로 작성한다. 과장·허위 금지.
- 회의내용(content)은 오직 '회의에서 무엇을 논의했는가'만 담는다. 회의 안건에 대한 논의 내용, 검토 사항, 쟁점, 추진 방향, 역할 분담, 후속 조치를 서술한다.
- 회의내용(content) 문단 구성: 1문단은 회의 개최 목적과 다룬 안건을 개괄한다(개최 사실과 장소는 언급해도 되나, 반드시 '사업의 원활한 운영을 위하여'처럼 사업 운영상의 목적으로 서술한다). 2문단부터는 안건별로 논의·검토된 내용과 향후 추진 방향, 후속 조치를 서술한다.
  예시: '데이터보안·활용 혁신융합대학사업의 원활한 운영을 위하여 6월 정례회의를 개최하였음. 회의는 공대5호관 106호에서 진행되었으며, 사업 운영 전반에 관한 정례적 점검과 논의를 목적으로 하였음. 주요 안건으로 학사 운영 현황과 비교과 프로그램 추진 방안을 다루었음.'
- 회의내용(content)에 다음은 절대 쓰지 않는다. 서류에 그런 내용이 아무리 많아도 한 문장도 옮기지 않는다.
  (1) '회의비 집행을 위하여 회의를 개최함'처럼 회의비 지출을 회의 목적으로 서술하는 문장.
  (2) 회의비 집행·내부결재·예산 승인·국고/직접비/그밖의사업운영경비 등 예산 항목에 관한 서술.
  (3) 식사 장소·상호·메뉴·주문 내역·결제 수단·카드사·영수증·증빙 첨부에 관한 서술.
  (4) 지출결의·결재 라인·기안자·검토자·협조자·전결·서명·직위·문서번호·시행일 등 행정 처리 절차에 관한 서술.
  (5) 참석 인원 수(예: 'OO명')와 금액.
- 지출결의서·영수증·서명부처럼 행정 서류만 있고 논의 내용을 알 수 있는 자료(계획서·결과보고서·안건지 등)가 없으면, 회의안건에서 확인되는 범위 안에서만 서술하고 지어내지 않는다. 그 경우 supplement 에 '회의 논의 내용을 확인할 자료가 없어 회의안건 중심으로만 작성함'이라고 적는다.
- 보완요청(supplement): (1) 서류 간 회의 일자·시간이 서로 다르면 어떤 서류가 어떻게 다른지, (2) 영수증 결제 시각이 회의 시작보다 이르거나 회의 종료 1시간 이내이면 그 사실을 적는다. 문제가 하나도 없으면 정확히 '보완사항 없음'이라고 적는다. (이 값은 회의록 문서 맨 위에도 표시된다.)
- filenameBase: '[yyyy-mm-dd(요일) 안건요약]' 형식(대괄호 포함). 안건요약은 핵심 안건 10자 내외.
- 정보를 찾지 못한 값은 빈 문자열/빈 배열로 둔다(추측 금지)."""


def build_prompt(meeting_dir, json_path):
    return (
        "당신은 대학 사업단의 회의비 정산용 '회의록' 작성 도구입니다.\n"
        "'" + meeting_dir + "' 폴더 안의 모든 회의 자료 파일을 읽으세요(하위 폴더 포함).\n"
        "PDF와 이미지(영수증·서명부 사진 등)는 직접 읽으세요.\n"
        ".docx 는 ZIP 압축 파일이므로, Bash 도구에서 사용 가능한 방법(unzip, python, powershell 등 "
        "그 환경에서 실제로 동작하는 것)으로 풀어 word/document.xml 의 본문 텍스트를 읽으세요.\n"
        ".hwp 는 직접 읽기 어려우니 읽지 못하면 supplement 에 '한글(.hwp) 파일은 PDF로 변환 후 다시 넣어주세요'라고 적으세요.\n"
        "아래 [규칙]에 따라 회의록 내용을 정리한 뒤, 결과를 정확히 '" + json_path + "' 경로에 UTF-8 JSON 파일로 저장하세요(Write 도구 사용).\n"
        "JSON 스키마:\n"
        '{\n'
        '  "filenameBase": "[yyyy-mm-dd(요일) 안건요약]",\n'
        '  "agenda": "회의안건",\n'
        '  "date": "YYYY. M. D. (요일) HH:MM ~ HH:MM",\n'
        '  "place": "회의장소",\n'
        '  "expensePlace": "회의비 사용처(영수증 가맹점명)",\n'
        '  "amount": "금액(영수증 합계, 예: 120,000원)",\n'
        '  "attendees": [{"org": "강원대학교", "name": "이성재"}, {"org": "강원대학교", "name": "황승재"}],\n'
        '  "content": ["회의내용 1문단(여러 문장)", "2문단(여러 문장)"],\n'
        '  "supplement": "보완요청. 문제 없으면 \\"보완사항 없음\\""\n'
        '}\n'
        "attendees 는 서명부에 서명한 사람을 소속/이름으로 한 명씩 담으세요.\n"
        "위 JSON 파일 하나만 저장하고 다른 파일은 만들지 마세요. 반드시 한국어로 작성하세요.\n\n"
        "[규칙]\n" + RULES
    )


# ---- .docx 생성 (표준 라이브러리만 사용, 한글 안전) ----
def _esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def _rpr(bold=False, size=22, color=None):
    s = '<w:rPr><w:rFonts w:ascii="%s" w:eastAsia="%s" w:hAnsi="%s"/>' % (FONT, FONT, FONT)
    if bold:
        s += '<w:b/>'
    if color:
        s += '<w:color w:val="%s"/>' % color
    s += '<w:sz w:val="%d"/><w:szCs w:val="%d"/></w:rPr>' % (size, size)
    return s


def _runs(text, rpr):
    segs = str(text).split("\n")
    out = ""
    for i, seg in enumerate(segs):
        if i > 0:
            out += '<w:r><w:br/></w:r>'
        out += '<w:r>' + rpr + '<w:t xml:space="preserve">' + _esc(seg) + '</w:t></w:r>'
    return out


def _para(text, bold=False, size=22, color=None, align=None, after=120):
    ppr = '<w:pPr><w:spacing w:after="%d" w:line="288" w:lineRule="auto"/>' % after
    if align:
        ppr += '<w:jc w:val="%s"/>' % align
    ppr += '</w:pPr>'
    return '<w:p>' + ppr + _runs(text, _rpr(bold, size, color)) + '</w:p>'


def _cp(text, bold=False, align=None, size=22, after=0):
    # 표 셀 안 문단
    ppr = '<w:pPr><w:spacing w:after="%d" w:line="264" w:lineRule="auto"/>' % after
    if align:
        ppr += '<w:jc w:val="%s"/>' % align
    ppr += '</w:pPr>'
    return '<w:p>' + ppr + _runs(text, _rpr(bold=bold, size=size)) + '</w:p>'


def _tc(inner, w=None, gridspan=None, vmerge=None, shade=None, valign="center"):
    tcpr = '<w:tcPr>'
    tcpr += ('<w:tcW w:w="%d" w:type="dxa"/>' % w) if w else '<w:tcW w:w="0" w:type="auto"/>'
    if gridspan:
        tcpr += '<w:gridSpan w:val="%d"/>' % gridspan
    if vmerge == "restart":
        tcpr += '<w:vMerge w:val="restart"/>'
    elif vmerge == "continue":
        tcpr += '<w:vMerge/>'
    if shade:
        tcpr += '<w:shd w:val="clear" w:color="auto" w:fill="%s"/>' % shade
    tcpr += '<w:vAlign w:val="%s"/></w:tcPr>' % valign
    return '<w:tc>' + tcpr + inner + '</w:tc>'


SHADE = "F2F2F2"


def _norm_att(a):
    if isinstance(a, dict):
        org = str(a.get("org") or a.get("소속") or "").strip()
        name = str(a.get("name") or a.get("이름") or "").strip()
    else:
        org, name = "", str(a).strip()
    return (org or DEFAULT_ORG), name


def build_docx(data, out_path):
    agenda = data.get("agenda", "")
    date = data.get("date", "")
    place = data.get("place", "")
    content = data.get("content", [])
    if isinstance(content, str):
        content = [content]
    supplement = str(data.get("supplement", "") or "").strip() or "보완사항 없음"
    has_issue = supplement != "보완사항 없음"
    attendees = [_norm_att(a) for a in (data.get("attendees") or []) if _norm_att(a)[1]]

    def kv(label, value):
        return ('<w:tr>' + _tc(_cp(label, bold=True, align="center"), w=1900, shade=SHADE)
                + _tc(_cp(value), gridspan=2) + '</w:tr>')

    rows = ""
    # 머리글
    rows += '<w:tr>' + _tc(_cp(HEADER_TITLE, bold=True, align="center", size=24), gridspan=3, shade=SHADE) + '</w:tr>'
    rows += kv("사 업 명", PROJECT_NAME)
    rows += kv("회의안건", agenda)
    rows += kv("회의일시", date)
    rows += kv("회의장소", place)
    rows += kv("회의비 사용처", data.get("expensePlace", ""))
    rows += kv("금액", data.get("amount", ""))

    # 참석자 (소속/이름)
    rows += ('<w:tr>'
             + _tc(_cp("참석자", bold=True, align="center"), w=1900, vmerge="restart", shade=SHADE)
             + _tc(_cp("소속", bold=True, align="center"), w=1900, shade=SHADE)
             + _tc(_cp("이름", bold=True, align="center"), w=5400, shade=SHADE)
             + '</w:tr>')
    if attendees:
        for i, (org, name) in enumerate(attendees):
            label_cell = _tc(_cp(""), w=1900, vmerge="continue")
            if i == 0 or attendees[i - 1][0] != org:
                org_cell = _tc(_cp(org, align="center"), w=1900, vmerge="restart")
            else:
                org_cell = _tc(_cp(""), w=1900, vmerge="continue")
            name_cell = _tc(_cp(name, align="center"), w=5400)
            rows += '<w:tr>' + label_cell + org_cell + name_cell + '</w:tr>'
    else:
        rows += ('<w:tr>' + _tc(_cp(""), w=1900, vmerge="continue")
                 + _tc(_cp(DEFAULT_ORG, align="center"), w=1900)
                 + _tc(_cp(""), w=5400) + '</w:tr>')

    # 회의내용 및 협의사항
    rows += '<w:tr>' + _tc(_cp("회의내용 및 협의사항", bold=True, align="center"), gridspan=3, shade=SHADE) + '</w:tr>'
    body_paras = "".join(_cp(p, after=60) for p in content if str(p).strip()) or _cp("")
    rows += '<w:tr>' + _tc(body_paras, gridspan=3, valign="top") + '</w:tr>'

    borders = "".join(
        '<w:%s w:val="single" w:sz="4" w:space="0" w:color="333333"/>' % e
        for e in ["top", "left", "bottom", "right", "insideH", "insideV"])
    tbl = ('<w:tbl><w:tblPr><w:tblW w:w="9200" w:type="dxa"/><w:jc w:val="center"/>'
           '<w:tblLayout w:type="fixed"/><w:tblBorders>'
           + borders + '</w:tblBorders></w:tblPr>'
           + '<w:tblGrid><w:gridCol w:w="1900"/><w:gridCol w:w="1900"/><w:gridCol w:w="5400"/></w:tblGrid>'
           + rows + '</w:tbl>')

    # 회의록 위쪽 보완요청 표시 (문제 있으면 빨간색, 없으면 회색)
    note_text = ("[보완요청] " + supplement) if has_issue else "[보완사항 없음]"
    note_color = "C00000" if has_issue else "808080"
    body = _para(note_text, bold=has_issue, size=20, color=note_color, align="left", after=120)
    body += _para("회 의 록", bold=True, size=36, align="center", after=200)
    body += tbl
    body += _para("", after=0)

    sect = ('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
            '<w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" '
            'w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>')
    document = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
                '<w:body>' + body + sect + '</w:body></w:document>')

    # 한글(HWP)에서도 안전하게 열리도록 styles.xml 과 관계 파일을 포함한다.
    styles = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
              '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
              '<w:docDefaults><w:rPrDefault><w:rPr>'
              '<w:rFonts w:ascii="%s" w:eastAsia="%s" w:hAnsi="%s" w:cs="%s"/>'
              '<w:sz w:val="22"/><w:szCs w:val="22"/>'
              '</w:rPr></w:rPrDefault>'
              '<w:pPrDefault><w:pPr>'
              '<w:spacing w:after="0" w:line="264" w:lineRule="auto"/>'
              '</w:pPr></w:pPrDefault></w:docDefaults>'
              '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">'
              '<w:name w:val="Normal"/><w:qFormat/></w:style>'
              '</w:styles>' % (FONT, FONT, FONT, FONT))

    content_types = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                     '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                     '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                     '<Default Extension="xml" ContentType="application/xml"/>'
                     '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
                     '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
                     '</Types>')
    rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            '</Relationships>')
    doc_rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
                '</Relationships>')

    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", rels)
        z.writestr("word/_rels/document.xml.rels", doc_rels)
        z.writestr("word/document.xml", document)
        z.writestr("word/styles.xml", styles)


def _sanitize(name):
    name = re.sub(r'[\\/:*?"<>|]', '', str(name))
    name = re.sub(r'[\r\n\t]+', ' ', name).strip()
    name = name.rstrip(". ")          # 윈도우는 이름 끝의 점/공백을 허용하지 않는다
    return name[:120] or "회의록"


def _unique(path):
    if not os.path.exists(path):
        return path
    base, ext = os.path.splitext(path)
    i = 2
    while os.path.exists("%s (%d)%s" % (base, i, ext)):
        i += 1
    return "%s (%d)%s" % (base, i, ext)


def _extract_json(text):
    """Claude 응답에서 JSON 객체를 최대한 관대하게 뽑아낸다."""
    if not text:
        return None
    text = text.strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if m:
        text = m.group(1).strip()
    try:
        return json.loads(text)
    except Exception:
        pass
    i, j = text.find("{"), text.rfind("}")
    if i != -1 and j > i:
        try:
            return json.loads(text[i:j + 1])
        except Exception:
            pass
    return None


# CLI 가 영어로 돌려주는 대표적인 오류를 한국어 안내로 바꾼다.
_LIMIT = "Claude 사용 한도 초과"
_KNOWN_ERRORS = [
    ("not logged in", "Claude 에 로그인되어 있지 않음 (명령 프롬프트에서 claude 실행 후 로그인)"),
    ("please run /login", "Claude 에 로그인되어 있지 않음 (명령 프롬프트에서 claude 실행 후 로그인)"),
    ("credit balance", "Claude 잔액 부족"),
    ("session limit", _LIMIT),
    ("usage limit", _LIMIT),
    ("hit your limit", _LIMIT),
    ("quota", _LIMIT),
    ("rate limit", "요청이 너무 잦음 (잠시 후 다시 시도)"),
    ("overloaded", "Claude 서버가 혼잡함 (잠시 후 다시 시도)"),
    ("network", "네트워크 연결 오류"),
    ("econnrefused", "네트워크 연결 오류"),
    ("etimedout", "네트워크 연결 시간 초과"),
]


def _failure_reason(r):
    """실패 사유를 사람이 읽을 수 있는 한 줄로 만든다.
    (--output-format json 의 출력이 그대로 노출되지 않도록 result 만 뽑아낸다.)"""
    text = ""
    outer = _extract_json(r.stdout)
    if isinstance(outer, dict):
        text = str(outer.get("result") or outer.get("error") or "").strip()
    if not text:
        text = (r.stderr or "").strip()
        text = text.splitlines()[-1] if text else ""
    low = text.lower()
    for key, korean in _KNOWN_ERRORS:
        if key in low:
            if korean == _LIMIT:
                # '· resets 7:50pm (Asia/Seoul)' 같은 해제 시각을 함께 알려준다.
                m = re.search(r"resets?\s+([^\n·]+)", text, re.I)
                if m:
                    return "%s — %s 에 풀림" % (korean, m.group(1).strip())
                return korean + " (한도가 풀린 뒤 다시 시도)"
            return korean
    if text:
        return text.replace("\n", " ")[:120]
    return "회의록 데이터가 생성되지 않음"


def default_output_dir():
    """바탕화면을 찾는다. OneDrive 로 옮겨진 경우까지 고려."""
    home = os.path.expanduser("~")
    for d in (os.path.join(home, "Desktop"),
              os.path.join(home, "OneDrive", "Desktop"),
              os.path.join(home, "OneDrive", "바탕 화면"),
              os.path.join(home, "바탕 화면")):
        if os.path.isdir(d):
            return os.path.join(d, "회의록 생성")
    return os.path.join(home, "회의록 생성")


# ---- 한 회의 폴더 처리 (백그라운드 스레드에서 호출) ----
def process_meeting(meeting_dir, output_dir):
    exe = find_claude()
    if not exe:
        return (False, "claude 명령을 찾을 수 없음", "")

    tmp = tempfile.mkdtemp(prefix="mm_")
    json_path = os.path.join(tmp, "meeting.json")
    args = claude_command(exe, [
        "-p", build_prompt(meeting_dir, json_path),
        "--output-format", "json",
        "--permission-mode", "acceptEdits",
        "--allowedTools", "Read,Glob,Grep,Write,Edit,Bash",
        "--add-dir", tmp,
    ])

    try:
        r = subprocess.run(args, **_run_kwargs(meeting_dir, TIMEOUT_SEC))
    except FileNotFoundError:
        shutil.rmtree(tmp, ignore_errors=True)
        log("실행 실패(FileNotFoundError): %s" % exe)
        return (False, "claude 실행 파일을 열 수 없음", "")
    except subprocess.TimeoutExpired:
        shutil.rmtree(tmp, ignore_errors=True)
        log("시간 초과: %s" % meeting_dir)
        return (False, "시간 초과(자료가 너무 많음)", "")
    except Exception as e:
        shutil.rmtree(tmp, ignore_errors=True)
        log("실행 오류: %s\n%s" % (meeting_dir, traceback.format_exc()))
        return (False, "실행 오류: " + str(e)[:60], "")

    data = None
    if not os.path.exists(json_path):
        cands = glob.glob(os.path.join(tmp, "*.json"))
        json_path = cands[0] if cands else None
    if json_path and os.path.exists(json_path):
        try:
            with open(json_path, encoding="utf-8-sig") as f:
                data = json.load(f)
        except Exception:
            try:
                with open(json_path, encoding="utf-8-sig") as f:
                    data = _extract_json(f.read())
            except Exception:
                data = None

    if data is None:
        # 파일이 없으면 CLI 출력(JSON)의 result 안에 내용이 들어있는 경우가 있다.
        outer = _extract_json(r.stdout)
        if isinstance(outer, dict) and outer.get("result"):
            data = _extract_json(str(outer.get("result")))

    if not isinstance(data, dict):
        shutil.rmtree(tmp, ignore_errors=True)
        log("회의록 데이터 없음: %s\nrc=%s\nstdout=%s\nstderr=%s"
            % (meeting_dir, r.returncode, (r.stdout or "")[:4000], (r.stderr or "")[:4000]))
        return (False, _failure_reason(r), "")

    base = _sanitize(data.get("filenameBase") or "회의록")
    out = _unique(os.path.join(output_dir, base + ".docx"))
    try:
        build_docx(data, out)
    except Exception as e:
        shutil.rmtree(tmp, ignore_errors=True)
        log("문서 생성 오류: %s\n%s" % (meeting_dir, traceback.format_exc()))
        return (False, "문서 생성 오류: " + str(e)[:60], "")
    note = str(data.get("supplement", "") or "").strip() or "보완사항 없음"
    shutil.rmtree(tmp, ignore_errors=True)
    return (True, out, note)


class App:
    def __init__(self, root):
        self.root = root
        root.title("회의록 자동 작성 도구")
        root.geometry("1040x640")
        root.configure(bg="#1b2432")

        self.meetings = []
        self.results = {}          # tree item -> 생성된 파일의 전체 경로
        self.output_dir = default_output_dir()
        self.running = False
        self.q = queue.Queue()

        drop = tk.Frame(root, bg="#232f42", height=88)
        drop.pack(fill="x", padx=16, pady=(16, 8))
        drop.pack_propagate(False)
        msg = ("여기에 회의 폴더를 끌어다 놓으세요.  (폴더 1개 = 회의 1건)"
               if HAS_DND else "아래 [회의 폴더 추가] 버튼으로 회의 폴더를 추가하세요.")
        tk.Label(drop, text=msg, bg="#232f42", fg="#9fb3c8",
                 font=(FONT, 12)).pack(expand=True)
        if HAS_DND:
            drop.drop_target_register(DND_FILES)
            drop.dnd_bind("<<Drop>>", self.on_drop)

        bar = tk.Frame(root, bg="#1b2432")
        bar.pack(fill="x", padx=16)
        self.btn_one = tk.Button(bar, text="＋ 회의 폴더 추가(한 건)", command=self.add_one,
                                 bg="#3b82f6", fg="white", relief="flat", padx=12, pady=6)
        self.btn_one.pack(side="left")
        self.btn_parent = tk.Button(bar, text="＋ 상위 폴더 추가(하위 폴더별로 회의)", command=self.add_parent,
                                    bg="#2563eb", fg="white", relief="flat", padx=12, pady=6)
        self.btn_parent.pack(side="left", padx=8)
        self.btn_out = tk.Button(bar, text="출력 폴더 선택", command=self.pick_output,
                                 bg="#475569", fg="white", relief="flat", padx=12, pady=6)
        self.btn_out.pack(side="right")

        cols = ("meeting", "status", "result", "note")
        self.tree = ttk.Treeview(root, columns=cols, show="headings", height=15)
        self.tree.heading("meeting", text="회의 (폴더)")
        self.tree.heading("status", text="상태")
        self.tree.heading("result", text="생성된 회의록 (더블클릭하면 열림)")
        self.tree.heading("note", text="보완요청")
        self.tree.column("meeting", width=330)
        self.tree.column("status", width=110, anchor="center")
        self.tree.column("result", width=340)
        self.tree.column("note", width=230)
        self.tree.pack(fill="both", expand=True, padx=16, pady=8)
        self.tree.bind("<Double-1>", self.open_result)

        self.out_lbl = tk.Label(root, text="", bg="#1b2432", fg="#9fb3c8",
                                font=(FONT, 9), anchor="w")
        self.out_lbl.pack(fill="x", padx=16)
        self.update_out_label()

        bottom = tk.Frame(root, bg="#1b2432")
        bottom.pack(fill="x", padx=16, pady=(4, 16))
        self.btn_clear = tk.Button(bottom, text="목록 초기화", command=self.clear,
                                   bg="#ef4444", fg="white", relief="flat", padx=12, pady=8)
        self.btn_clear.pack(side="left")
        self.progress = ttk.Progressbar(bottom, mode="determinate")
        self.progress.pack(side="left", fill="x", expand=True, padx=12)
        self.prog_lbl = tk.Label(bottom, text="0 / 0", bg="#1b2432", fg="#9fb3c8", width=10)
        self.prog_lbl.pack(side="left")
        self.start_btn = tk.Button(bottom, text="작업 시작", command=self.start,
                                   bg="#10b981", fg="white", relief="flat", padx=16, pady=8)
        self.start_btn.pack(side="right")

    def _set_inputs(self, state):
        for b in (self.btn_one, self.btn_parent, self.btn_out, self.btn_clear):
            b.config(state=state)

    def add_meeting_dir(self, d):
        d = os.path.abspath(d)
        if not os.path.isdir(d) or any(m[0] == d for m in self.meetings):
            return
        item = self.tree.insert("", "end", values=(d, "대기", "", ""))
        self.meetings.append([d, item])

    def add_one(self):
        d = filedialog.askdirectory(title="회의 자료가 들어있는 폴더 선택")
        if d:
            self.add_meeting_dir(d)

    def add_parent(self):
        p = filedialog.askdirectory(title="여러 회의 폴더가 들어있는 '상위' 폴더 선택")
        if not p:
            return
        subs = [os.path.join(p, x) for x in sorted(os.listdir(p))
                if os.path.isdir(os.path.join(p, x))]
        if not subs:
            messagebox.showinfo("안내", "선택한 폴더 안에 하위 폴더가 없습니다.")
            return
        for s in subs:
            self.add_meeting_dir(s)

    def on_drop(self, event):
        for path in self.root.tk.splitlist(event.data):
            if os.path.isdir(path):
                self.add_meeting_dir(path)

    def pick_output(self):
        d = filedialog.askdirectory(title="회의록을 저장할 출력 폴더 선택")
        if d:
            self.output_dir = d
            self.update_out_label()

    def update_out_label(self):
        self.out_lbl.config(text="출력 폴더: " + self.output_dir)

    def clear(self):
        if self.running:
            return
        for _, item in self.meetings:
            self.tree.delete(item)
        self.meetings = []
        self.results = {}
        self.progress["value"] = 0
        self.prog_lbl.config(text="0 / 0")

    def open_result(self, _event):
        sel = self.tree.selection()
        if not sel:
            return
        path = self.results.get(sel[0])
        if path and os.path.exists(path):
            try:
                os.startfile(path)
            except AttributeError:
                subprocess.Popen(["xdg-open", path])

    def start(self):
        if self.running:
            return
        if not self.meetings:
            messagebox.showinfo("안내", "먼저 회의 폴더를 추가하세요.")
            return

        ok, info = check_claude()
        if not ok:
            messagebox.showerror("claude 를 사용할 수 없습니다", info)
            return

        try:
            os.makedirs(self.output_dir, exist_ok=True)
        except Exception as e:
            messagebox.showerror("오류", "출력 폴더를 만들 수 없습니다.\n%s\n\n%s"
                                 % (self.output_dir, e))
            return

        self.running = True
        self.start_btn.config(state="disabled", text="작업 중...")
        self._set_inputs("disabled")
        self.progress["maximum"] = len(self.meetings)
        self.progress["value"] = 0
        self.results = {}
        for _, item in self.meetings:
            self.tree.set(item, "status", "대기")
            self.tree.set(item, "result", "")
            self.tree.set(item, "note", "")
        # 작업 중 목록이 바뀌지 않도록 복사본을 넘긴다.
        threading.Thread(target=self.worker, args=(list(self.meetings),),
                         daemon=True).start()
        self.root.after(200, self.poll)

    def worker(self, meetings):
        done = 0
        try:
            for d, item in meetings:
                self.q.put(("status", item, "작성 중..."))
                try:
                    ok, info, note = process_meeting(d, self.output_dir)
                except Exception as e:
                    log("회의 처리 중 오류: %s\n%s" % (d, traceback.format_exc()))
                    ok, info, note = False, "오류: " + str(e)[:60], ""
                done += 1
                self.q.put(("done", item, (ok, info, note, done, len(meetings))))
        finally:
            # 예외가 나도 UI 가 '작업 중...' 으로 멈추지 않도록 반드시 알린다.
            self.q.put(("finish", None, None))

    def poll(self):
        try:
            while True:
                kind, item, payload = self.q.get_nowait()
                if kind == "status":
                    self.tree.set(item, "status", payload)
                elif kind == "done":
                    ok, info, note, done, total = payload
                    self.tree.set(item, "status", "완료" if ok else "실패")
                    if ok:
                        self.results[item] = info
                        self.tree.set(item, "result", os.path.basename(info))
                    else:
                        self.tree.set(item, "result", "⚠ " + info)
                    self.tree.set(item, "note", note if ok else "")
                    self.progress["value"] = done
                    self.prog_lbl.config(text="%d / %d" % (done, total))
                elif kind == "finish":
                    self.running = False
                    self.start_btn.config(state="normal", text="작업 시작")
                    self._set_inputs("normal")
                    messagebox.showinfo("완료", "작업이 끝났습니다.\n출력 폴더:\n" + self.output_dir)
                    return
        except queue.Empty:
            pass
        if self.running:
            self.root.after(200, self.poll)


def _set_taskbar_identity():
    """작업 표시줄에서 파이썬이 아니라 이 프로그램의 아이콘이 보이도록 한다."""
    if os.name != "nt":
        return
    try:
        import ctypes
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(
            "kangwon.dsc.meetingminutes")
    except Exception:
        pass


def _apply_icon(root):
    ico = os.path.join(_resource_dir(), "icon.ico")
    if not os.path.exists(ico):
        return
    try:
        root.iconbitmap(default=ico)
    except Exception:
        pass


def main():
    _set_taskbar_identity()
    root = TkinterDnD.Tk() if HAS_DND else tk.Tk()
    _apply_icon(root)
    # tkinter 콜백에서 난 오류도 기록/표시되도록 연결
    root.report_callback_exception = _excepthook
    style = ttk.Style(root)
    try:
        style.theme_use("clam")
    except Exception:
        pass
    App(root)
    root.mainloop()


if __name__ == "__main__":
    main()
