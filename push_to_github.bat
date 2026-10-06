@echo off
set "PATH=C:\Program Files\Git\cmd;%PATH%"
title Push to GitHub - Tool Maintenance
echo ========================================================
echo   Pushing to https://github.com/rahulsudhakar0-jpg/Tool-Maintenance
echo ========================================================
echo.
echo Attempting git push...
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo ========================================================
    echo   Authentication required for GitHub!
    echo ========================================================
    echo Please paste your GitHub Personal Access Token (PAT) below.
    echo (Generate one at: https://github.com/settings/tokens with 'repo' scope)
    echo.
    set /p "GITHUB_TOKEN=Enter GitHub PAT: "
    if defined GITHUB_TOKEN (
        echo Pushing with provided token...
        git push https://%GITHUB_TOKEN%@github.com/rahulsudhakar0-jpg/Tool-Maintenance.git main
        if %errorlevel% equ 0 (
            echo.
            echo SUCCESS! Successfully pushed to GitHub main branch.
        )
    )
) else (
    echo.
    echo SUCCESS! Repository pushed successfully.
)

pause
