# -*- coding: utf-8 -*-
"""
회의록 자동 작성 도구 - 본체(기능)

이 파일은 실행기(.exe)가 켜질 때마다 최신본을 내려받아 실행합니다.
따라서 기능이 바뀌어도 .exe 를 다시 받으실 필요가 없습니다.
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

# .exe 로 묶여 실행될 때 필요한 코덱을 시작하자마자 불러 둔다.
# 파이썬은 코덱을 쓰는 순간에 import 하는데, 그 사이 임시 폴더(_MEIxxxx)가
# 백신·정리 프로그램에 지워지면 import 가 실패해 파일을 못 읽게 된다.
try:
    import encodings.utf_8_sig    # noqa: F401
    import encodings.cp949        # noqa: F401
    import encodings.idna         # noqa: F401  (urllib 이 주소를 처리할 때 필요)
except Exception:
    pass
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


# 규칙 파일 (프로그램 옆에 두면 이 내용이 우선 적용된다)
RULES_FILE = "규칙.txt"
RULES_BASE_FILE = "규칙.기본값.txt"
RULES_HEADER = (
    "# 회의록 작성 규칙\n"
    "# 이 파일을 고치면 회의록의 문체와 판단 기준이 바뀝니다.\n"
    "# 저장만 하면 다음 [작업 시작] 부터 바로 반영됩니다. (프로그램을 다시 켜지 않아도 됨)\n"
    "# '#' 으로 시작하는 줄은 설명이라 무시됩니다.\n"
    "# 기본값으로 되돌리려면 이 파일을 지우고 프로그램을 다시 켜세요.\n"
    "\n"
)


# ---- 오류 기록 (.pyw 는 콘솔이 없어서 오류가 보이지 않으므로 파일로 남긴다) ----
def _app_dir():
    # 실행기가 알려준 위치(.exe 가 있는 폴더)를 우선 쓴다.
    given = globals().get("APP_DIR")
    if given:
        return given
    # .exe 로 묶인 경우 __file__ 은 임시 폴더를 가리키므로 실행 파일 위치를 쓴다.
    if getattr(sys, "frozen", False):
        return os.path.dirname(os.path.abspath(sys.executable))
    try:
        return os.path.dirname(os.path.abspath(__file__))
    except Exception:
        return os.path.dirname(os.path.abspath(sys.argv[0]))


def _read_text(path):
    """BOM 이 있어도 안전하게 읽는다.

    utf-8-sig 로 여는 대신 바이트로 읽고 BOM 을 직접 떼어낸다.
    .exe 로 묶인 상태에서 임시 폴더가 사라지면 utf-8-sig 코덱을 뒤늦게
    불러오다 실패하는데, utf-8 은 시작할 때 이미 올라와 있어 안전하다."""
    with open(path, "rb") as f:
        raw = f.read()
    if raw.startswith(b"\xef\xbb\xbf"):
        raw = raw[3:]
    return raw.decode("utf-8", "replace")


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
    "Claude 에 로그인되어 있지 않은 것으로 보입니다.\n\n"
    "로그인이 필요하다면 아래 순서로 한 번만 하시면 됩니다.\n\n"
    "  1. 시작 메뉴에서 '명령 프롬프트' 를 엽니다.\n"
    "  2. claude auth login --claudeai  를 입력하고 Enter 를 누릅니다.\n"
    "  3. 안내에 따라 로그인합니다. (브라우저가 열립니다)\n\n"
    "다만 이 확인이 틀릴 수도 있습니다.\n"
    "데스크톱 Claude 앱을 함께 쓰고 있거나 로그인 정보를 갱신하는 중이면\n"
    "실제로는 로그인되어 있는데도 이렇게 보일 수 있습니다.\n\n"
    "그래도 지금 작업을 시작할까요?\n"
    "(이미 로그인하셨다면 [예] 를 누르세요. 실제로 로그인이 안 되어 있으면\n"
    " 각 회의가 '로그인되어 있지 않음' 으로 표시될 뿐 프로그램은 멀쩡합니다.)"
)


def check_claude():
    """실행 전 점검.

    돌려주는 값은 (상태, 안내문).
    상태는 'ok'(정상), 'no_claude'(claude 를 쓸 수 없음), 'no_login'(로그인 의심)."""
    exe = find_claude()
    if not exe:
        return ("no_claude", "claude 명령을 찾을 수 없습니다.\n\n"
                             "Claude Code 를 설치한 뒤 컴퓨터를 다시 시작하거나,\n"
                             "명령 프롬프트에서 'claude --version' 이 동작하는지 확인해 주세요.")
    try:
        r = subprocess.run(claude_command(exe, ["--version"]), **_run_kwargs(None, 60))
    except Exception as e:
        return ("no_claude", "claude 실행에 실패했습니다.\n\n%s\n%s" % (exe, e))
    if r.returncode != 0:
        return ("no_claude", "claude 실행에 실패했습니다.\n\n%s\n%s"
                % (exe, (r.stderr or r.stdout or "").strip()[:300]))
    version = (r.stdout or "").strip()

    # 로그인 여부는 참고용으로만 본다. 이 확인이 틀려도 작업을 막지 않는다.
    try:
        a = subprocess.run(claude_command(exe, ["auth", "status", "--json"]),
                           **_run_kwargs(None, 60))
        info = _extract_json(a.stdout)
        if isinstance(info, dict) and info.get("loggedIn") is False:
            log("로그인 확인 결과 loggedIn=false\nstdout=%s\nstderr=%s"
                % ((a.stdout or "")[:500], (a.stderr or "")[:500]))
            return ("no_login", LOGIN_HELP)
    except Exception:
        pass        # 예전 버전이라 auth 명령이 없으면 그냥 넘어간다
    return ("ok", version)


# ---- 회의록 작성 규칙 (여기만 고치면 문체/판단 기준이 바뀝니다) ----
RULES_DEFAULT = """- 회의는 끝난 뒤 작성하는 문서이므로 완료·과거 관점으로 작성.
- 회의안건(agenda): 서류(공문·계획서 등)에 나타난 회의 안건.
- 회의일시(date): 'YYYY. M. D. (요일) HH:MM ~ HH:MM' 형식. 종료 시각을 모르면 시작 시각 + 1시간.
- 회의장소(place): 회의/행사가 실제 진행된 장소.
- 회의비 사용처(expensePlace): 영수증에 찍힌 가맹점(상호)명.
- 금액(amount): 영수증 결제 합계 금액(예: '120,000원'). 여러 영수증이면 합산.
- 참석자(attendees): 각 항목은 {"org":"소속","name":"이름"} 객체. 소속을 알 수 없으면 org 를 '강원대학교'로 둔다. 추측 금지.
  · 참석 서명부가 있으면 서명부에 실제로 서명한 사람만 넣는다.
  · 서명부가 없으면 회의계획서·공문·참석자 명단 등 다른 서류에서 참석자로 확인되는 사람을 넣는다. 그마저 없으면 빈 배열.
- 참석 서명부는 금액(amount)이 500,000원 이상일 때만 반드시 있어야 한다. 500,000원 이상인데 서명부가 없으면 supplement 에 '회의비 50만원 이상 집행 건은 참석 서명부가 필요하나 확인되지 않음'이라고 적는다. 500,000원 미만이면 서명부가 없어도 보완사항으로 적지 않는다.
- 회의내용(content): 원칙적으로 2문단으로 작성한다(다룬 안건이 많으면 최대 3문단). 배열의 각 원소가 한 문단이며, content 배열 길이는 2 또는 3이어야 한다. 각 문단은 4~5개의 문장(약 4~5줄 분량)으로 구성한다. 개조식(항목 나열)으로 쓰지 말고 문단형 서술로 작성한다. 과장·허위 금지.
- 회의내용(content) 어미: 모든 문장을 '~하였음', '~되었음', '~하기로 하였음', '~임을 확인하였음' 같은 과거 명사체로 끝낸다. '~함', '~한다', '~했다', '~하였다'로 쓰지 않는다.
- 회의내용(content)에 회의 개최 사실·일시·장소를 쓰지 않는다. 이미 위 항목에 있으므로 중복이다. '…에서 회의를 개최하였음', '회의는 …호에서 진행되었으며' 같은 문장으로 시작하지 말고 곧바로 안건 논의 내용으로 들어간다.
- 회의내용(content) 1문단: 첫 문장은 회의안건을 받아 '(안건)에 대해 논의하였음' 또는 '(안건)을 위한 논의를 진행하였음' 형태로 시작한다. 다만 안건 문구가 이미 '논의', '회의', '협의' 등으로 끝나면 표현이 겹치지 않게 다듬는다(예: '운영 방향 논의를 위한 논의를 진행하였음'(X) → '운영 방향에 대해 논의하였음'(O)). 이어서 그 안건의 배경·목적·핵심 검토 사항과 참석자들이 공감·확인한 내용을 서술한다.
- 회의내용(content) 2문단: '향후 ~에 대해서도 논의하였음', '~ 세부 운영 계획에 대해서도 논의하였음', '구체적으로는 ~' 처럼 시작해 세부 추진 방안·역할 분담·일정·후속 조치를 서술하고, 마지막 문장은 '~하기로 하였음'으로 맺는다.
- 회의내용(content) 작성 예시(이 문체와 길이를 그대로 따를 것):
  1문단: '성과 공유회 운영을 위한 논의를 진행하였음. 성과 공유회의 목적은 사업 추진 결과와 주요 성과를 대내외적으로 확산하고, 참여 기관 및 관계자들과 성과를 공유하는 데 있음을 확인하였음. 공유회에서 발표할 주요 내용과 구성 방향을 논의하였으며, 교육과정 운영 성과, 비교과 프로그램 결과, 산학협력 및 프로젝트 수행 성과를 중심으로 발표 자료를 구성하기로 하였음. 또한 참여 대상과 초청 범위를 설정하여 행사 운영의 효율성을 높이기로 하였음.'
  2문단: '성과 공유회 세부 운영 계획에 대해서도 논의하였음. 행사 일정과 장소, 진행 방식(발표 및 전시, 질의응답 등)을 구체화하기로 하였으며, 발표자 선정과 역할 분담을 통해 준비 과정을 체계적으로 추진하기로 하였음. 홍보 및 참석자 안내 방안도 함께 검토하였으며, 행사 종료 후 만족도 조사 및 결과 정리를 통해 향후 성과 확산 및 차년도 행사 기획에 반영하기로 하였음.'
- 회의내용(content)은 오직 '회의에서 무엇을 논의했는가'만 담는다. 회의 안건에 대한 논의 내용, 검토 사항, 쟁점, 추진 방향, 역할 분담, 후속 조치를 서술한다.
- 회의내용(content)에 다음은 절대 쓰지 않는다. 서류에 그런 내용이 아무리 많아도 한 문장도 옮기지 않는다.
  (1) '회의비 집행을 위하여 회의를 개최함'처럼 회의비 지출을 회의 목적으로 서술하는 문장, 그리고 회의 개최 사실·일시·장소를 다시 설명하는 문장.
  (2) 회의비 집행·내부결재·예산 승인·국고/직접비/그밖의사업운영경비 등 예산 항목에 관한 서술.
  (3) 식사 장소·상호·메뉴·주문 내역·결제 수단·카드사·영수증·증빙 첨부에 관한 서술.
  (4) 지출결의·결재 라인·기안자·검토자·협조자·전결·서명·직위·문서번호·시행일 등 행정 처리 절차에 관한 서술.
  (5) 참석 인원 수(예: 'OO명')와 금액.
- 지출결의서·영수증·서명부처럼 행정 서류만 있고 논의 내용을 알 수 있는 자료(계획서·결과보고서·안건지 등)가 없으면, 회의안건에서 확인되는 범위 안에서만 서술하고 지어내지 않는다. 그 경우 supplement 에 '회의 논의 내용을 확인할 자료가 없어 회의안건 중심으로만 작성함'이라고 적는다.
- 보완요청(supplement): 아래 (1)~(4) 에 해당할 때만 적는다. 해당하지 않는 것은 절대 쓰지 않는다.
  (1) 서류 간 회의 일자·시간이 서로 다르면 어떤 서류가 어떻게 다른지.
  (2) 영수증 결제 시각이 회의 시작 시각보다 이른 경우.
  (3) 영수증 결제 시각이 회의 종료 시각보다 1시간 미만으로 늦은 경우(회의 중 결제 포함).
  (4) 금액이 500,000원 이상인데 참석 서명부가 없는 경우.
  ★ 결제 시각 판단 기준: 회의가 끝난 뒤 식사를 하므로 '결제 시각이 회의 종료 시각보다 1시간 이상 늦은 것'이 정상이다. 이 경우는 아무 문제가 없으므로 절대 보완사항으로 적지 말 것. (예: 회의 종료 12:00, 결제 13:32 → 1시간 32분 늦음 → 정상, 적지 않음. 회의 종료 12:00, 결제 12:29 → 29분 늦음 → (3)에 해당하므로 적음)
  문제가 하나도 없으면 정확히 '보완사항 없음'이라고 적는다. (이 값은 회의록 문서 맨 위에도 표시된다.)
- filenameBase: 'yyyy-mm-dd 요일 안건요약' 형식(예: '2026-07-22 수 예산집행검토'). 안건요약은 핵심 안건 10자 내외. 정산 시스템에 올릴 파일 이름이므로 대괄호·괄호·따옴표·빗금 같은 특수문자를 절대 넣지 말고 한글·영문·숫자·공백·하이픈만 사용한다.
- 정보를 찾지 못한 값은 빈 문자열/빈 배열로 둔다(추측 금지)."""


def load_rules():
    """규칙.txt 가 있으면 그 내용을 쓴다.

    사용자가 손대지 않은 파일은 프로그램이 업데이트될 때 최신 기본 규칙으로
    자동 갱신하고, 직접 고친 파일은 건드리지 않는다."""
    d = _app_dir()
    path = os.path.join(d, RULES_FILE)
    base = os.path.join(d, RULES_BASE_FILE)
    try:
        if os.path.exists(path):
            cur = _read_text(path)
            was = _read_text(base) if os.path.exists(base) else ""
            if cur.strip() and cur.strip() != was.strip():
                body = "\n".join(l for l in cur.splitlines()
                                 if not l.lstrip().startswith("#")).strip()
                if body:
                    return body          # 사용자가 고친 규칙
        # 처음 실행이거나 손대지 않은 경우 → 최신 기본 규칙으로 써 둔다
        for p in (path, base):
            with open(p, "w", encoding="utf-8") as f:
                f.write(RULES_HEADER + RULES_DEFAULT + "\n")
    except Exception:
        log("규칙 파일 처리 실패\n" + traceback.format_exc())
    return RULES_DEFAULT


def build_prompt(meeting_dir, json_path):
    return (
        "당신은 대학 사업단의 회의비 정산용 '회의록' 작성 도구입니다.\n"
        "'" + meeting_dir + "' 폴더 안의 모든 회의 자료 파일을 읽으세요(하위 폴더 포함).\n"
        "다만 이 폴더에 있는 .hwpx 파일과, 파일명이 날짜(yyyy-mm-dd)로 시작하는 .docx 파일은 "
        "이 도구가 앞서 만든 회의록이므로 자료가 아닙니다. "
        "그런 파일은 열지도 말고 참고하지도 마세요.\n"
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
        "[규칙]\n" + load_rules()
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


# ---- .hwpx 생성 (한글 2014 이상에서 열리는 개방형 한글 문서) ----
# 단위: HWPUNIT = 1/7200 인치. docx 의 dxa(1/20 pt) 에 5 를 곱하면 된다.
HWPX_PAGE_W, HWPX_PAGE_H = 59528, 84188      # A4
HWPX_MARGIN = 7090                            # 25mm
HEADER_FOOTER_MARGIN = 4252
HWPX_TBL_W = 45000                            # 표 전체 너비
# 글자 모양: (굵게, docx 크기(하프포인트), 색). 목록 순서가 그대로 charPr id 가 된다.
HWPX_CHARS = [
    (False, 22, None),      # 0 본문
    (True, 22, None),       # 1 표 라벨
    (True, 24, None),       # 2 머리글
    (True, 36, None),       # 3 '회 의 록'
    (False, 20, "808080"),  # 4 보완사항 없음
    (True, 20, "C00000"),   # 5 보완요청
]
HWPX_ALIGNS = ["LEFT", "CENTER", "JUSTIFY"]   # paraPr id 0, 1, 2
HWPX_BF_NONE, HWPX_BF_CELL, HWPX_BF_SHADE = 1, 2, 3


def _hwpx_char_id(bold=False, size=22, color=None):
    return HWPX_CHARS.index((bool(bold), int(size), color))


def _hwpx_p(text, char_id=0, para_id=0):
    """문단 하나. 줄바꿈은 문단 분리로 처리한다."""
    out = ""
    for seg in str(text).split("\n"):
        out += ('<hp:p id="0" paraPrIDRef="%d" styleIDRef="0" pageBreak="0"'
                ' columnBreak="0" merged="0">'
                '<hp:run charPrIDRef="%d"><hp:t>%s</hp:t></hp:run>'
                '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000"'
                ' textheight="1000" baseline="850" spacing="600" horzpos="0"'
                ' horzsize="%d" flags="393216"/></hp:linesegarray>'
                '</hp:p>' % (para_id, char_id, _esc(seg), HWPX_TBL_W))
    return out


def _hwpx_tc(paras, col, row, colspan, rowspan, width, height, shade=False):
    bf = HWPX_BF_SHADE if shade else HWPX_BF_CELL
    return ('<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0"'
            ' dirty="0" borderFillIDRef="%d">'
            '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK"'
            ' vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0"'
            ' textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">%s</hp:subList>'
            '<hp:cellAddr colAddr="%d" rowAddr="%d"/>'
            '<hp:cellSpan colSpan="%d" rowSpan="%d"/>'
            '<hp:cellSz width="%d" height="%d"/>'
            '<hp:cellMargin left="510" right="510" top="141" bottom="141"/>'
            '</hp:tc>' % (bf, paras, col, row, colspan, rowspan, width, height))


def _hwpx_header_xml():
    fonts = ""
    for lang in ("HANGUL", "LATIN", "HANJA", "JAPANESE", "OTHER", "SYMBOL", "USER"):
        fonts += ('<hh:fontface lang="%s" fontCnt="1">'
                  '<hh:font id="0" face="%s" type="TTF" isEmbedded="0">'
                  '<hh:typeInfo familyType="FCAT_GOTHIC" weight="0" proportion="0"'
                  ' contrast="0" strokeVariation="0" armStyle="0" letterform="0"'
                  ' midline="0" xHeight="0"/></hh:font></hh:fontface>' % (lang, FONT))

    def border_fill(bid, solid, fill):
        edge = ('<hh:%s type="%s" width="%s" color="%s"/>')
        sides = ""
        for s in ("leftBorder", "rightBorder", "topBorder", "bottomBorder"):
            sides += (edge % (s, "SOLID", "0.12 mm", "#333333") if solid
                      else edge % (s, "NONE", "0.1 mm", "#000000"))
        brush = ('<hc:fillBrush><hc:winBrush faceColor="#%s" hatchColor="#999999"'
                 ' alpha="0"/></hc:fillBrush>' % fill) if fill else ""
        return ('<hh:borderFill id="%d" threeD="0" shadow="0" centerLine="NONE"'
                ' breakCellSeparateLine="0">'
                '<hh:slash type="NONE" Crooked="0" isCounter="0"/>'
                '<hh:backSlash type="NONE" Crooked="0" isCounter="0"/>'
                '%s<hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/>%s'
                '</hh:borderFill>' % (bid, sides, brush))

    fills = (border_fill(HWPX_BF_NONE, False, None)
             + border_fill(HWPX_BF_CELL, True, None)
             + border_fill(HWPX_BF_SHADE, True, SHADE))

    chars = ""
    for i, (bold, size, color) in enumerate(HWPX_CHARS):
        chars += ('<hh:charPr id="%d" height="%d" textColor="#%s" shadeColor="none"'
                  ' useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="%d">'
                  '<hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0"'
                  ' symbol="0" user="0"/>'
                  '<hh:ratio hangul="100" latin="100" hanja="100" japanese="100"'
                  ' other="100" symbol="100" user="100"/>'
                  '<hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0"'
                  ' symbol="0" user="0"/>'
                  '<hh:relSz hangul="100" latin="100" hanja="100" japanese="100"'
                  ' other="100" symbol="100" user="100"/>'
                  '<hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0"'
                  ' symbol="0" user="0"/>'
                  '%s</hh:charPr>'
                  % (i, size * 50, color or "000000", HWPX_BF_NONE,
                     "<hh:bold/>" if bold else ""))

    paras = ""
    for i, align in enumerate(HWPX_ALIGNS):
        paras += ('<hh:paraPr id="%d" tabPrIDRef="0" condense="0" fontLineHeight="0"'
                  ' snapToGrid="1" suppressLineNumbers="0" checked="0">'
                  '<hh:align horizontal="%s" vertical="BASELINE"/>'
                  '<hh:heading type="NONE" idRef="0" level="0"/>'
                  '<hh:breakSetting breakLatinWord="KEEP_WORD"'
                  ' breakNonLatinWord="BREAK_WORD" widowOrphan="0" keepWithNext="0"'
                  ' keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>'
                  '<hh:autoSpacing eAsianEng="0" eAsianNum="0"/>'
                  '<hh:margin>'
                  '<hc:intent value="0" unit="HWPUNIT"/>'
                  '<hc:left value="0" unit="HWPUNIT"/>'
                  '<hc:right value="0" unit="HWPUNIT"/>'
                  '<hc:prev value="0" unit="HWPUNIT"/>'
                  '<hc:next value="0" unit="HWPUNIT"/>'
                  '</hh:margin>'
                  '<hh:lineSpacing type="PERCENT" value="160" unit="HWPUNIT"/>'
                  '<hh:border borderFillIDRef="%d" offsetLeft="0" offsetRight="0"'
                  ' offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/>'
                  '</hh:paraPr>' % (i, align, HWPX_BF_NONE))

    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"'
            ' xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core"'
            ' version="1.4" secCnt="1">'
            '<hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>'
            '<hh:refList>'
            '<hh:fontfaces itemCnt="7">' + fonts + '</hh:fontfaces>'
            '<hh:borderFills itemCnt="3">' + fills + '</hh:borderFills>'
            '<hh:charProperties itemCnt="%d">' % len(HWPX_CHARS) + chars
            + '</hh:charProperties>'
            '<hh:tabProperties itemCnt="1">'
            '<hh:tabPr id="0" autoTabLeft="0" autoTabRight="0"/>'
            '</hh:tabProperties>'
            '<hh:numberings itemCnt="0"/>'
            '<hh:paraProperties itemCnt="%d">' % len(HWPX_ALIGNS) + paras
            + '</hh:paraProperties>'
            '<hh:styles itemCnt="1">'
            '<hh:style id="0" type="PARA" name="바탕글" engName="Normal"'
            ' paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042"'
            ' lockForm="0"/>'
            '</hh:styles>'
            '</hh:refList>'
            '<hh:compatibleDocument targetProgram="HWP201X">'
            '<hh:layoutCompatibility/></hh:compatibleDocument>'
            '</hh:head>')


def _hwpx_section_xml(data):
    agenda = data.get("agenda", "")
    content = data.get("content", [])
    if isinstance(content, str):
        content = [content]
    supplement = str(data.get("supplement", "") or "").strip() or "보완사항 없음"
    has_issue = supplement != "보완사항 없음"
    attendees = [_norm_att(a) for a in (data.get("attendees") or []) if _norm_att(a)[1]]

    w = [int(round(HWPX_TBL_W * n / 9200.0)) for n in (1900, 1900)]
    w.append(HWPX_TBL_W - w[0] - w[1])
    RH = 1700                                   # 기본 행 높이

    label = _hwpx_char_id(True, 22)
    body_c = _hwpx_char_id(False, 22)
    rows_xml, r = "", 0

    def tr(cells):
        return "<hp:tr>" + "".join(cells) + "</hp:tr>"

    # 머리글
    rows_xml += tr([_hwpx_tc(_hwpx_p(HEADER_TITLE, _hwpx_char_id(True, 24), 1),
                             0, r, 3, 1, HWPX_TBL_W, RH, shade=True)])
    r += 1
    for lab, val in (("사 업 명", PROJECT_NAME), ("회의안건", agenda),
                     ("회의일시", data.get("date", "")), ("회의장소", data.get("place", "")),
                     ("회의비 사용처", data.get("expensePlace", "")),
                     ("금액", data.get("amount", ""))):
        rows_xml += tr([_hwpx_tc(_hwpx_p(lab, label, 1), 0, r, 1, 1, w[0], RH, shade=True),
                        _hwpx_tc(_hwpx_p(val, body_c, 0), 1, r, 2, 1, w[1] + w[2], RH)])
        r += 1

    # 참석자 (세로 병합은 rowSpan 으로 표현하고, 병합된 행에서는 셀을 아예 넣지 않는다)
    att = attendees or [(DEFAULT_ORG, "")]
    span = 1 + len(att)
    rows_xml += tr([_hwpx_tc(_hwpx_p("참석자", label, 1), 0, r, 1, span, w[0], RH, shade=True),
                    _hwpx_tc(_hwpx_p("소속", label, 1), 1, r, 1, 1, w[1], RH, shade=True),
                    _hwpx_tc(_hwpx_p("이름", label, 1), 2, r, 1, 1, w[2], RH, shade=True)])
    r += 1
    i = 0
    while i < len(att):
        j = i
        while j + 1 < len(att) and att[j + 1][0] == att[i][0]:
            j += 1
        group = j - i + 1
        for k in range(i, j + 1):
            cells = []
            if k == i:
                cells.append(_hwpx_tc(_hwpx_p(att[i][0], body_c, 1), 1, r, 1, group, w[1], RH))
            cells.append(_hwpx_tc(_hwpx_p(att[k][1], body_c, 1), 2, r, 1, 1, w[2], RH))
            rows_xml += tr(cells)
            r += 1
        i = j + 1

    # 회의내용
    rows_xml += tr([_hwpx_tc(_hwpx_p("회의내용 및 협의사항", label, 1),
                             0, r, 3, 1, HWPX_TBL_W, RH, shade=True)])
    r += 1
    paras = "".join(_hwpx_p(p, body_c, 2) for p in content if str(p).strip()) \
        or _hwpx_p("", body_c, 2)
    rows_xml += tr([_hwpx_tc(paras, 0, r, 3, 1, HWPX_TBL_W, RH * 6)])
    r += 1

    tbl = ('<hp:tbl id="1" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM"'
           ' textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL"'
           ' repeatHeader="1" rowCnt="%d" colCnt="3" cellSpacing="0"'
           ' borderFillIDRef="%d" noAdjust="0">'
           '<hp:sz width="%d" widthRelTo="ABSOLUTE" height="%d" heightRelTo="ABSOLUTE"'
           ' protect="0"/>'
           '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0"'
           ' holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP"'
           ' horzAlign="LEFT" vertOffset="0" horzOffset="0"/>'
           '<hp:outMargin left="0" right="0" top="0" bottom="0"/>'
           '<hp:inMargin left="510" right="510" top="141" bottom="141"/>'
           '%s</hp:tbl>' % (r, HWPX_BF_CELL, HWPX_TBL_W, RH * r, rows_xml))

    sec_pr = ('<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134"'
              ' tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1"'
              ' memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0">'
              '<hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0" strtnum="0"/>'
              '<hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>'
              '<hp:visibility hideFirstHeader="0" hideFirstFooter="0"'
              ' hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL"'
              ' hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/>'
              '<hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/>'
              '<hp:pagePr landscape="WIDELY" width="%d" height="%d" gutterType="LEFT_ONLY">'
              '<hp:margin header="%d" footer="%d" gutter="0" left="%d" right="%d"'
              ' top="%d" bottom="%d"/></hp:pagePr>'
              '<hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar=""'
              ' suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID"'
              ' width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="850"'
              ' belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS"'
              ' newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/>'
              '</hp:footNotePr>'
              '<hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar=""'
              ' suffixChar=")" supscript="0"/><hp:noteLine length="14692" type="SOLID"'
              ' width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="0"'
              ' belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS"'
              ' newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/>'
              '</hp:endNotePr>'
              % (HWPX_PAGE_W, HWPX_PAGE_H, HEADER_FOOTER_MARGIN, HEADER_FOOTER_MARGIN,
                 HWPX_MARGIN, HWPX_MARGIN, HWPX_MARGIN, HWPX_MARGIN))
    for kind in ("BOTH", "EVEN", "ODD"):
        sec_pr += ('<hp:pageBorderFill type="%s" borderFillIDRef="%d" textBorder="PAPER"'
                   ' headerInside="0" footerInside="0" fillArea="PAPER">'
                   '<hp:offset left="1417" right="1417" top="1417" bottom="1417"/>'
                   '</hp:pageBorderFill>' % (kind, HWPX_BF_NONE))
    sec_pr += '</hp:secPr>'

    note_text = ("[보완요청] " + supplement) if has_issue else "[보완사항 없음]"
    note_char = _hwpx_char_id(True, 20, "C00000") if has_issue \
        else _hwpx_char_id(False, 20, "808080")

    first = ('<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0"'
             ' columnBreak="0" merged="0"><hp:run charPrIDRef="%d">%s<hp:t>%s</hp:t>'
             '</hp:run>'
             '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000"'
             ' textheight="1000" baseline="850" spacing="600" horzpos="0"'
             ' horzsize="%d" flags="393216"/></hp:linesegarray></hp:p>'
             % (note_char, sec_pr, _esc(note_text), HWPX_TBL_W))

    title = _hwpx_p("회 의 록", _hwpx_char_id(True, 36), 1)
    tbl_p = ('<hp:p id="0" paraPrIDRef="1" styleIDRef="0" pageBreak="0"'
             ' columnBreak="0" merged="0"><hp:run charPrIDRef="%d">%s</hp:run>'
             '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000"'
             ' textheight="1000" baseline="850" spacing="600" horzpos="0"'
             ' horzsize="%d" flags="393216"/></hp:linesegarray></hp:p>'
             % (body_c, tbl, HWPX_TBL_W))

    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section"'
            ' xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"'
            ' xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core">'
            + first + title + tbl_p + _hwpx_p("", body_c, 0) + '</hs:sec>')


def build_hwpx(data, out_path):
    """한글(HWPX) 문서를 만든다. 표준 라이브러리만 사용한다."""
    header = _hwpx_header_xml()
    section = _hwpx_section_xml(data)

    version = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
               '<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version"'
               ' tagetApplication="WORDPROCESSOR" major="5" minor="0" micro="5"'
               ' buildNumber="0" os="1" xmlVersion="1.4"'
               ' application="Hancom Office Hangul" appVersion="9.1.1.5656"/>')
    container = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                 '<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container"'
                 ' xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf">'
                 '<ocf:rootfiles>'
                 '<ocf:rootfile full-path="Contents/content.hpf"'
                 ' media-type="application/hwpml-package+xml"/>'
                 '</ocf:rootfiles></ocf:container>')
    parts = [("Contents/content.hpf", "application/hwpml-package+xml"),
             ("Contents/header.xml", "application/xml"),
             ("Contents/section0.xml", "application/xml"),
             ("settings.xml", "application/xml")]
    manifest = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                '<odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"'
                ' version="1.2">'
                + "".join('<odf:file-entry full-path="%s" media-type="%s"/>' % p
                          for p in parts)
                + '</odf:manifest>')
    content_hpf = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                   '<opf:package xmlns:opf="http://www.idpf.org/2007/opf/"'
                   ' xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app"'
                   ' xmlns:dc="http://purl.org/dc/elements/1.1/"'
                   ' version="" unique-identifier="" id="">'
                   '<opf:metadata>'
                   '<opf:title>%s</opf:title>'
                   '<opf:language>ko</opf:language>'
                   '<opf:meta name="creator" content=""/>'
                   '</opf:metadata>'
                   '<opf:manifest>'
                   '<opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>'
                   '<opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>'
                   '<opf:item id="settings" href="settings.xml" media-type="application/xml"/>'
                   '</opf:manifest>'
                   '<opf:spine>'
                   '<opf:itemref idref="header" linear="yes"/>'
                   '<opf:itemref idref="section0" linear="yes"/>'
                   '</opf:spine>'
                   '</opf:package>' % _esc(HEADER_TITLE))
    settings = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                '<ha:HWPApplicationSetting'
                ' xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app"'
                ' xmlns:config="http://www.hancom.co.kr/hwpml/2011/configItemSet">'
                '<ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/>'
                '</ha:HWPApplicationSetting>')

    # 미리보기 텍스트 (한글이 파일 목록에서 쓰는 값. 없어도 열리지만 넣어 둔다)
    preview = "\n".join([HEADER_TITLE, str(data.get("agenda", "") or ""),
                         str(data.get("date", "") or "")])

    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as z:
        # mimetype 은 반드시 첫 항목이며 압축하지 않는다.
        z.writestr(zipfile.ZipInfo("mimetype"), "application/hwp+zip",
                   compress_type=zipfile.ZIP_STORED)
        z.writestr("version.xml", version)
        z.writestr("META-INF/container.xml", container)
        z.writestr("META-INF/manifest.xml", manifest)
        z.writestr("Contents/content.hpf", content_hpf)
        z.writestr("Contents/header.xml", header)
        z.writestr("Contents/section0.xml", section)
        z.writestr("settings.xml", settings)
        z.writestr("Preview/PrvText.txt", preview)


def _sanitize(name):
    """정산 시스템에 올릴 수 있도록 안전한 글자만 남긴다.

    한글·영문·숫자·공백·하이픈·밑줄만 두고 나머지(대괄호, 괄호, 그리고
    \\ / : * ? " < > | 같은 문자)는 공백으로 바꾼 뒤 공백을 정리한다."""
    name = re.sub(r"[^0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ \-_]", " ", str(name))
    name = re.sub(r"\s+", " ", name).strip()
    name = name.strip("-_. ")         # 윈도우는 이름 끝의 점/공백을 허용하지 않는다
    return name[:120] or "회의록"


def _unique(path):
    if not os.path.exists(path):
        return path
    base, ext = os.path.splitext(path)
    i = 2
    # 괄호는 정산 시스템 업로드에서 거부될 수 있어 '-2' 형태로 붙인다.
    while os.path.exists("%s-%d%s" % (base, i, ext)):
        i += 1
    return "%s-%d%s" % (base, i, ext)


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


# ---- 한 회의 폴더 처리 (백그라운드 스레드에서 호출) ----
def process_meeting(meeting_dir):
    exe = find_claude()
    if not exe:
        return (False, "claude 명령을 찾을 수 없음", "")

    tmp = tempfile.mkdtemp(prefix="mm_")
    json_path = os.path.join(tmp, "meeting.json")
    args = claude_command(exe, [
        "-p", build_prompt(meeting_dir, json_path),
        "--output-format", "json",
        "--permission-mode", "acceptEdits",
        "--allowedTools", "Read,Glob,Grep,Write,Edit,Bash,PowerShell",
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
            text = _read_text(json_path)
        except Exception:
            log("결과 파일을 읽지 못함: %s\n%s" % (json_path, traceback.format_exc()))
            text = ""
        try:
            data = json.loads(text)
        except Exception:
            data = _extract_json(text)

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
    # 회의록은 회의 자료가 들어 있는 그 폴더에 저장한다.
    out = _unique(os.path.join(meeting_dir, base + ".hwpx"))
    try:
        build_hwpx(data, out)
    except Exception as e:
        # 한글 문서를 만들지 못하면 회의록을 통째로 잃지 않도록 워드 문서로 남긴다.
        log("한글 문서 생성 오류: %s\n%s" % (meeting_dir, traceback.format_exc()))
        try:
            if os.path.exists(out):
                os.remove(out)
            out = _unique(os.path.join(meeting_dir, base + ".docx"))
            build_docx(data, out)
        except Exception:
            shutil.rmtree(tmp, ignore_errors=True)
            log("워드 문서 생성도 실패\n" + traceback.format_exc())
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

        tk.Label(root, text="회의록은 각 회의 폴더 안에 만들어집니다.",
                 bg="#1b2432", fg="#9fb3c8", font=(FONT, 9), anchor="w"
                 ).pack(fill="x", padx=16)

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
        for b in (self.btn_one, self.btn_parent, self.btn_clear):
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

        state, info = check_claude()
        if state == "no_claude":
            messagebox.showerror("claude 를 사용할 수 없습니다", info)
            return
        if state == "no_login":
            # 이 확인은 틀릴 수 있으므로 막지 않고 물어본다.
            if not messagebox.askyesno("로그인 확인", info):
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
                    ok, info, note = process_meeting(d)
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
                    messagebox.showinfo("완료", "작업이 끝났습니다.\n\n회의록은 각 회의 폴더 안에 만들어졌습니다.")
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
