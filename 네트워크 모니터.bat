@echo off
echo ====================================
echo    TraceNet ???? ??? ??
echo ====================================
cd /d "%~dp0\server"
echo ?? ?? ?... (3? ? ???? ?? ??)
start "" "http://localhost:5000"
timeout /t 3 /nobreak >nul
dotnet run
