@echo off
title Force Study AI
echo ========================================================
echo          STARTING FORCE STUDY AI MEME SCOLDER
echo ========================================================
echo.
echo Launching server at http://localhost:8000 ...
echo Press Ctrl+C in this window to stop the server.
echo.

start "" http://localhost:8000
python server.py

pause
