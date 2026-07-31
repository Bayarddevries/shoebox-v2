@echo off
REM Metis Kin Exhibit - ADMIN SETUP + LAUNCH
REM
REM Fixes the WSL2 portproxy rules (they go stale whenever the WSL IP
REM changes, e.g. after a reboot) and starts the exhibit servers.
REM
REM IMPORTANT: RIGHT-CLICK this file -> "Run as administrator".
REM (netsh portproxy requires elevation. Admin is only needed for the
REM  portproxy step - the servers themselves run fine without it.)
REM
REM After it runs once, the rules persist. Re-run after every WSL reboot
REM (WSL gets a new IP each boot, which breaks the old rules).

setlocal enabledelayedexpansion
echo === Metis Kin Exhibit - Admin fix ===
echo.

REM --- 1. Detect the CURRENT WSL IP ---
for /f "delims=" %%i in ('wsl -d Ubuntu hostname -I 2^>nul') do set "WSLIP=%%i"
for /f "tokens=1" %%a in ("%WSLIP%") do set "WSLIP=%%a"
if "%WSLIP%"=="" (
    echo ERROR: could not detect the WSL IP. Is WSL running?
    pause
    exit /b 1
)
echo [1/4] Current WSL IP: %WSLIP%

REM --- 2. Remove stale portproxy rules (8081/8082 only) ---
echo [2/4] Removing stale portproxy rules...
netsh interface portproxy delete v4tov4 listenport=8081 listenaddress=0.0.0.0 >nul 2>&1
netsh interface portproxy delete v4tov4 listenport=8082 listenaddress=0.0.0.0 >nul 2>&1

REM --- 3. Add rules pointing at the CURRENT WSL IP ---
echo [3/4] Adding portproxy rules...
netsh interface portproxy add v4tov4 listenport=8081 listenaddress=0.0.0.0 connectport=8081 connectaddress=%WSLIP%
if errorlevel 1 (
    echo ERROR: could not add portproxy rule 8081. Is this window elevated?
    pause
    exit /b 1
)
netsh interface portproxy add v4tov4 listenport=8082 listenaddress=0.0.0.0 connectport=8082 connectaddress=%WSLIP%
echo       State  :8081 -^> %WSLIP%:8081
echo       Static :8082 -^> %WSLIP%:8082

REM --- 4. Restart the exhibit servers in WSL ---
echo [4/4] Starting servers...
wsl -d Ubuntu pkill -f "exhibit-server.py" 2>nul
wsl -d Ubuntu pkill -f "serve-exhibit.py" 2>nul
timeout /t 1 /nobreak >nul
start /min wsl -d Ubuntu bash -ic "cd ~/projects/Shoebox\ V2 && python3 scripts/exhibit-server.py"
start /min wsl -d Ubuntu bash -ic "cd ~/projects/Shoebox\ V2 && python3 scripts/serve-exhibit.py"
timeout /t 3 /nobreak >nul

REM --- Verify ---
curl -s http://localhost:8081/health >nul 2>&1 && echo [OK] State server  :8081 || echo FAIL: state server :8081
curl -s -o nul -w "%%{http_code}" http://localhost:8082/controller.html >nul 2>&1 && echo [OK] Static server  :8082 || echo FAIL: static server :8082

echo.
echo ============================================================
echo   DISPLAY (big screen):  http://localhost:8082/projector.html?exhibit
echo   CONTROLLER (tablet):   http://100.65.25.105:8082/controller.html
echo   (phone must be connected to Tailscale)
echo ============================================================
echo.
echo Tip: WSL gets a new IP every reboot. If the tablet stops
echo connecting, re-run this file (as admin) and it fixes itself.
echo.
pause
