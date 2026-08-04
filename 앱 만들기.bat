@echo off
setlocal
cd /d "%~dp0"

rem ============================================================
rem  회의록도구를 독립 실행 프로그램(.exe)으로 만듭니다.
rem  이 파일은 처음 한 번만 실행하면 됩니다.
rem  * 반드시 CRLF 줄바꿈 + ANSI(CP949) 로 저장해야 합니다.
rem ============================================================

set "PYC="
where py.exe >nul 2>nul
if not errorlevel 1 set "PYC=py -3"
if defined PYC goto HAVEPY
where python.exe >nul 2>nul
if not errorlevel 1 set "PYC=python"
if defined PYC goto HAVEPY
goto NOPYTHON

:HAVEPY
%PYC% "%~dp0앱만들기.py"
echo.
pause
exit /b 0

:NOPYTHON
echo.
echo  [안내] 파이썬(Python)이 설치되어 있지 않습니다.
echo  https://www.python.org/downloads/  에서 설치해 주세요.
echo  설치 첫 화면에서 반드시 "Add Python to PATH" 를 체크하세요.
echo.
echo  * 프로그램(.exe)을 만들 때만 파이썬이 필요합니다.
echo    다 만들고 나면 파이썬 없는 PC 에서도 .exe 가 그대로 실행됩니다.
echo.
pause
exit /b 1
