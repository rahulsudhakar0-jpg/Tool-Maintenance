@echo off
set "PATH=C:\Program Files\Git\bin;C:\Program Files\Git\cmd;%PATH%"
title Push to GitHub - Tool Maintenance
echo ========================================================
echo   Pushing to https://github.com/rahulsudhakar0-jpg/Tool-Maintenance
echo ========================================================
echo.
echo Syncing with GitHub...
git add .
git commit -m "chore: manual sync from tool maintenance batch" 2>nul
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo   SUCCESS! Pushed to GitHub main branch.
    echo ========================================================
) else (
    echo.
    echo Push failed. Please check your network or repository settings.
)

pause
