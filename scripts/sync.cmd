@echo off
REM Headless solostereo sync wrapper for Windows Task Scheduler (or manual run).
REM Resolves the project root from this file's location, runs the sync, and
REM appends output to data\sync.log (gitignored).
cd /d "%~dp0.."
call npm run sync >> "data\sync.log" 2>&1
