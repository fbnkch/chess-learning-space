@echo off
cd /d "%~dp0"
rem Reinstall when packages are missing or out of date (e.g. after a pull).
call npm ls --depth=0 >nul 2>&1
if errorlevel 1 (
  call npm ci
  if errorlevel 1 (
    echo Installing packages failed. Close other running chess servers and try again.
    pause
    exit /b 1
  )
)
call npm start
