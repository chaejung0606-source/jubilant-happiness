# -*- coding: utf-8 -*-
"""
'회의록도구.pyw' 를 독립 실행 프로그램(회의록도구.exe)으로 만듭니다.

- 이 파일은 윈도우에서 한 번만 실행하면 됩니다. (앱 만들기.bat 더블클릭)
- 만들어진 .exe 는 파이썬이 설치되지 않은 다른 PC 에서도 그대로 실행됩니다.
- 단, 회의록을 만들려면 그 PC 에도 Claude Code 는 설치/로그인되어 있어야 합니다.
"""
import os
import sys
import shutil
import subprocess

APP_NAME = "회의록도구"
SRC = "회의록도구.pyw"
ICON = "icon.ico"

HERE = os.path.dirname(os.path.abspath(__file__))


def say(msg=""):
    print(msg, flush=True)


def die(msg):
    say()
    say("  [실패] " + msg)
    say()
    sys.exit(1)


def run(args, what):
    say("  - " + what)
    r = subprocess.run(args)
    if r.returncode != 0:
        die(what + " 단계에서 오류가 났습니다. 위 메시지를 확인해 주세요.")


def ensure(module, package=None):
    try:
        __import__(module)
        return True
    except ImportError:
        pass
    run([sys.executable, "-m", "pip", "install", "--disable-pip-version-check",
         package or module], (package or module) + " 설치")
    try:
        __import__(module)
        return True
    except ImportError:
        return False


def main():
    os.chdir(HERE)
    say("=" * 58)
    say("  회의록도구 - 실행 프로그램(.exe) 만들기")
    say("=" * 58)
    say()

    if not os.path.exists(SRC):
        die("'%s' 파일이 이 폴더에 없습니다." % SRC)

    say("[1/4] 필요한 도구를 확인합니다.")
    if not ensure("PyInstaller", "pyinstaller"):
        die("pyinstaller 설치에 실패했습니다. 인터넷 연결을 확인해 주세요.")
    has_dnd = ensure("tkinterdnd2")
    say("  - 드래그앤드롭 기능: " + ("포함" if has_dnd else "제외(버튼으로 폴더 추가 가능)"))
    say()

    say("[2/4] 이전 빌드 결과를 정리합니다.")
    for d in ("build", "dist"):
        shutil.rmtree(os.path.join(HERE, d), ignore_errors=True)
    spec = os.path.join(HERE, APP_NAME + ".spec")
    if os.path.exists(spec):
        os.remove(spec)
    say("  - 완료")
    say()

    say("[3/4] 프로그램을 만듭니다. (수 분 걸릴 수 있습니다)")
    args = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",           # 파일 하나로 묶기
        "--windowed",          # 검은 콘솔 창 띄우지 않기
        "--name", APP_NAME,
    ]
    if os.path.exists(os.path.join(HERE, ICON)):
        args += ["--icon", ICON]
        # 프로그램 안에서도 창 아이콘으로 쓰도록 함께 넣는다
        args += ["--add-data", ICON + os.pathsep + "."]
    if has_dnd:
        args += ["--collect-all", "tkinterdnd2"]
    args.append(SRC)
    run(args, "빌드")
    say()

    say("[4/4] 결과를 정리합니다.")
    built = os.path.join(HERE, "dist", APP_NAME + ".exe")
    if not os.path.exists(built):
        built = os.path.join(HERE, "dist", APP_NAME)
    if not os.path.exists(built):
        die("실행 파일이 만들어지지 않았습니다.")

    final = os.path.join(HERE, os.path.basename(built))
    if os.path.exists(final):
        try:
            os.remove(final)
        except OSError:
            die("기존 '%s' 를 지울 수 없습니다. 프로그램이 실행 중이면 닫아 주세요."
                % os.path.basename(final))
    shutil.copy2(built, final)

    shutil.rmtree(os.path.join(HERE, "build"), ignore_errors=True)
    shutil.rmtree(os.path.join(HERE, "dist"), ignore_errors=True)
    if os.path.exists(spec):
        os.remove(spec)

    size = os.path.getsize(final) / (1024.0 * 1024.0)
    say("  - 완료")
    say()
    say("=" * 58)
    say("  다 만들었습니다.")
    say()
    say("  파일: %s  (%.0f MB)" % (final, size))
    say()
    say("  이제 이 파일만 더블클릭하면 실행됩니다.")
    say("  바탕화면이나 작업 표시줄에 끌어다 놓고 쓰셔도 됩니다.")
    say("  다른 PC 로 옮길 때도 이 파일 하나만 복사하면 됩니다.")
    say("=" * 58)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        import traceback
        traceback.print_exc()
        say()
        say("  [실패] 예상치 못한 오류가 났습니다. 위 내용을 알려주세요.")
        sys.exit(1)
