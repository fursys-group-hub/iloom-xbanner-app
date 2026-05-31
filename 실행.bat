@echo off
chcp 65001 >nul
title 일룸 X배너 어플
cd /d "%~dp0app"
where node >nul 2>nul || (echo. & echo  [!] Node.js가 설치되어 있지 않아요. & echo      https://nodejs.org 에서 LTS 버전을 설치한 뒤 이 파일을 다시 실행해 주세요. & echo. & pause & exit /b)
echo.
echo   일룸 X배너 어플을 켜는 중이에요... 잠시만 기다리면 브라우저가 자동으로 열려요.
echo   (이 검은 창은 어플이 켜져 있는 동안 그대로 두세요. 창을 닫으면 어플도 꺼져요.)
echo.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep 2; Start-Process 'http://localhost:3000'"
node server.js
echo.
echo   어플이 종료되었어요. (이미 실행 중이었다면 열린 브라우저를 그대로 쓰세요.)
pause
