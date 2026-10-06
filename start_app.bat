@echo off
title Tool Maintenance Web App Launcher
echo ========================================================
echo   Starting Tool Maintenance Management System...
echo ========================================================
powershell -ExecutionPolicy Bypass -NoExit -File "%~dp0server.ps1"
pause
