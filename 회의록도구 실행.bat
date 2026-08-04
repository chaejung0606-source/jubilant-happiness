@echo off
setlocal
cd /d "%~dp0"

rem ============================================================
rem  회의록 자동 작성 도구 실행기
rem  * 이 파일은 반드시 CRLF 줄바꿈 + ANSI(CP949) 로 저장해야 합니다.
rem  * 문제 확인이 필요하면 명령 프롬프트에서  실행.bat debug  로 실행하세요.
rem ============================================================

rem ---- 실행할 .pyw 파일 찾기 (파일 이름에 한글이 있어도 안전) ----
set "PYW="
for %%F in ("%~dp0*.pyw") do set "PYW=%%~fF"
if not defined PYW goto NOPYW

rem ---- 콘솔용 파이썬 찾기 ----
set "PYC="
where py.exe >nul 2>nul
if not errorlevel 1 set "PYC=py -3"
if defined PYC goto HAVEPY
where python.exe >nul 2>nul
if not errorlevel 1 set "PYC=python"
if defined PYC goto HAVEPY
goto NOPYTHON

:HAVEPY
rem ---- 창 없이 띄우는 파이썬 찾기 (없으면 콘솔용으로 대체) ----
set "PYWEXE="
where pyw.exe >nul 2>nul
if not errorlevel 1 set "PYWEXE=pyw -3"
if defined PYWEXE goto HAVEPYW
where pythonw.exe >nul 2>nul
if not errorlevel 1 set "PYWEXE=pythonw"
if defined PYWEXE goto HAVEPYW
set "PYWEXE=%PYC%"

:HAVEPYW
rem ---- 드래그앤드롭 기능용 (한 번만 설치됨, 없어도 프로그램은 동작) ----
%PYC% -c "import tkinterdnd2" >nul 2>nul
if not errorlevel 1 goto LAUNCH
echo  드래그앤드롭 기능을 준비하는 중입니다... (처음 한 번만)
%PYC% -m pip install --quiet --disable-pip-version-check tkinterdnd2 >nul 2>nul

:LAUNCH
if /i "%~1"=="debug" goto DEBUGRUN
start "" %PYWEXE% "%PYW%"
exit /b 0

:DEBUGRUN
echo  [진단 모드] 오류 메시지가 아래에 그대로 표시됩니다.
echo  실행 파일: %PYW%
echo.
%PYC% "%PYW%"
echo.
echo  [진단 모드] 프로그램이 종료되었습니다.
pause
exit /b 0

:NOPYW
echo.
echo  [오류] 이 폴더에 .pyw 파일이 없습니다.
echo  회의록도구.pyw 파일을 이 배치 파일과 같은 폴더에 두세요.
echo.
pause
exit /b 1

:NOPYTHON
echo.
echo  [안내] 파이썬(Python)이 설치되어 있지 않습니다.
echo  https://www.python.org/downloads/  에서 설치해 주세요.
echo  설치 첫 화면에서 반드시 "Add Python to PATH" 를 체크하세요.
echo.
pause
exit /b 1
