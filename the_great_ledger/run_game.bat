@echo off
title The Great Ledger - Local Server
echo ==========================================================
echo       THE GREAT LEDGER - COZY RPG HABIT TRACKER
echo ==========================================================
echo.
echo [1/2] Launching default web browser to http://localhost:8000 ...
start "" "http://localhost:8000"
echo.
echo [2/2] Igniting lightweight Python server...
echo.
echo (To terminate the server, press Ctrl+C in this window)
echo ==========================================================
python -m http.server 8000
pause
