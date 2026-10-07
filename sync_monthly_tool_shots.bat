@echo off
title Monthly Tool Shot Synchronizer
echo ============================================================
echo   Tool Maintenance System - Monthly Tool Shot Sync
echo ============================================================
echo.
cd /d "%~dp0"

echo [1/3] Detecting latest monthly Excel template and updating data...
node sync_monthly_tool_shots.js
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Monthly sync encountered an error.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Staging updated datasets...
"C:\Program Files\Git\bin\git.exe" add data.js excel_data.json unified_tools_2024_2025_2026.csv jinrong_tool_shots.json jinrong_linkage_summary.json

echo.
echo [3/3] Committing and pushing monthly update to GitHub...
"C:\Program Files\Git\bin\git.exe" commit -m "Auto-sync monthly Jinrong tool shots (Col AI & AH)"
"C:\Program Files\Git\bin\git.exe" push origin main

echo.
echo ============================================================
echo   SUCCESS: Monthly Tool Shot sync complete and pushed!
echo ============================================================
timeout /t 5
