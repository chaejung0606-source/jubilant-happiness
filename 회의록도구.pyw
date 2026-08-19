# -*- coding: utf-8 -*-
"""
회의록 자동 작성 도구 - 실행기

이 파일(.exe)은 거의 바뀌지 않습니다.
실제 기능은 core.py 에 들어 있고, 프로그램을 켤 때마다 최신 core.py 를
내려받아 실행합니다. 그래서 기능이 바뀌어도 .exe 를 다시 받을 필요가 없습니다.
"""
import os
import sys
import json
import hashlib
import datetime
import tempfile
import traceback
import urllib.request

# ---- 본체(core.py)가 쓰는 모듈을 여기서 미리 불러 둔다 ----
# 본체는 실행 중에 내려받으므로 빌드할 때 자동으로 포함되지 않는다.
# 여기서 import 해 두어야 .exe 안에 함께 들어가고, 실행 중 임시 폴더가
# 사라져도 뒤늦은 import 로 실패하지 않는다.
import re                       # noqa: F401
import glob                     # noqa: F401
import queue                    # noqa: F401
import shutil                   # noqa: F401
import zipfile                  # noqa: F401
import threading                # noqa: F401
import subprocess               # noqa: F401
import tkinter                  # noqa: F401
import tkinter.ttk              # noqa: F401
import tkinter.filedialog       # noqa: F401
import tkinter.messagebox       # noqa: F401
from tkinter import messagebox
try:
    import encodings.utf_8_sig  # noqa: F401
    import encodings.cp949      # noqa: F401
    import encodings.idna       # noqa: F401
except Exception:
    pass
try:
    import tkinterdnd2          # noqa: F401
except Exception:
    pass

LAUNCHER_VERSION = 1            # 실행기 자체가 바뀔 때만 올린다
APP_REPO = "chaejung0606-source/jubilant-happiness"
RELEASE_TAG = "app-latest"
UPDATE_API = "https://api.github.com/repos/%s/releases/tags/%s" % (APP_REPO, RELEASE_TAG)
CORE_NAME = "core.py"
VERSION_NAME = "version.json"


def app_dir():
    if getattr(sys, "frozen", False):
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))


def log_path():
    d = app_dir()
    if not os.access(d, os.W_OK):
        d = tempfile.gettempdir()
    return os.path.join(d, "오류기록.txt")


def log(msg):
    try:
        stamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(log_path(), "a", encoding="utf-8") as f:
            f.write("[%s] %s\n" % (stamp, msg))
    except Exception:
        pass


def cache_dir():
    """내려받은 본체를 보관하는 곳. 프로그램 폴더를 어지럽히지 않도록 따로 둔다."""
    base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
    d = os.path.join(base, "MeetingMinutesTool")
    try:
        os.makedirs(d, exist_ok=True)
    except Exception:
        d = tempfile.gettempdir()
    return d


def _get(url, timeout, binary=False):
    req = urllib.request.Request(url, headers={
        "Accept": "application/vnd.github+json",
        "User-Agent": "meeting-minutes-tool",
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
    return raw if binary else raw.decode("utf-8", "replace")


def _read_text(path):
    with open(path, "rb") as f:
        raw = f.read()
    if raw.startswith(b"\xef\xbb\xbf"):
        raw = raw[3:]
    return raw.decode("utf-8", "replace")


def _sha256_bytes(b):
    return hashlib.sha256(b).hexdigest()


def bundled_core():
    """.exe 안에 함께 넣어 둔 본체 (처음 실행하거나 인터넷이 안 될 때 사용)."""
    base = getattr(sys, "_MEIPASS", None) or os.path.dirname(os.path.abspath(__file__))
    p = os.path.join(base, CORE_NAME)
    return p if os.path.exists(p) else None


def update_core():
    """최신 본체를 받아 캐시에 저장한다. 실패해도 조용히 넘어간다.

    돌려주는 값은 (본체 경로, 새로 갱신했는지)."""
    path = os.path.join(cache_dir(), CORE_NAME)
    have = ""
    if os.path.exists(path):
        try:
            have = _sha256_bytes(open(path, "rb").read())
        except Exception:
            have = ""
    try:
        data = json.loads(_get(UPDATE_API, 20))
        asset = None
        for a in data.get("assets", []):
            if a.get("name") == CORE_NAME:
                asset = a
                break
        if asset:
            digest = str(asset.get("digest") or "").replace("sha256:", "").strip().lower()
            if digest and digest != have:
                raw = _get(asset["browser_download_url"], 120, binary=True)
                if _sha256_bytes(raw) == digest:
                    with open(path, "wb") as f:
                        f.write(raw)
                    return (path, True)
                log("본체 내려받기 중단: 해시가 일치하지 않음")
    except Exception:
        pass                       # 인터넷이 안 되면 캐시본으로 실행한다
    if os.path.exists(path):
        return (path, False)
    return (bundled_core(), False)


def launcher_update_needed():
    """실행기 자체를 새로 받아야 하는지 확인한다. (거의 없는 일)"""
    try:
        data = json.loads(_get(UPDATE_API, 20))
        for a in data.get("assets", []):
            if a.get("name") == VERSION_NAME:
                info = json.loads(_get(a["browser_download_url"], 20))
                return int(info.get("launcher", 0)) > LAUNCHER_VERSION
    except Exception:
        pass
    return False


def run_core(path):
    src = _read_text(path)
    # 규칙.txt·오류기록.txt 는 본체가 아니라 .exe 가 있는 폴더에 두어야 하므로
    # 실행기가 그 위치를 알려 준다.
    scope = {"__name__": "회의록도구_본체", "__file__": path,
             "__builtins__": __builtins__, "APP_DIR": app_dir()}
    exec(compile(src, path, "exec"), scope)          # noqa: S102
    scope["main"]()


def main():
    path, _ = update_core()
    if not path:
        try:
            messagebox.showerror(
                "실행할 수 없습니다",
                "프로그램 기능 파일을 내려받지 못했습니다.\n\n"
                "인터넷 연결을 확인하신 뒤 다시 실행해 주세요.\n"
                "계속 안 되면 아래 파일 내용을 알려주세요.\n" + log_path())
        except Exception:
            pass
        return

    if launcher_update_needed():
        try:
            messagebox.showinfo(
                "안내",
                "프로그램을 새로 내려받아야 하는 변경이 있습니다.\n\n"
                "지금은 그대로 사용하실 수 있으며,\n"
                "새 파일 받는 방법은 따로 안내드리겠습니다.")
        except Exception:
            pass

    try:
        run_core(path)
    except Exception:
        log("본체 실행 오류 (%s)\n%s" % (path, traceback.format_exc()))
        # 내려받은 본체가 잘못됐을 수 있으니 지우고, 내장본으로 한 번 더 시도한다.
        try:
            cached = os.path.join(cache_dir(), CORE_NAME)
            if os.path.abspath(path) == os.path.abspath(cached):
                os.remove(cached)
        except Exception:
            pass
        fallback = bundled_core()
        if fallback and os.path.abspath(fallback) != os.path.abspath(path):
            try:
                run_core(fallback)
                return
            except Exception:
                log("내장 본체 실행도 실패\n" + traceback.format_exc())
        try:
            messagebox.showerror(
                "오류",
                "프로그램을 실행하지 못했습니다.\n\n자세한 내용:\n" + log_path())
        except Exception:
            pass


if __name__ == "__main__":
    main()
