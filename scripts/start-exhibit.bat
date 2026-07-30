@echo off
REM Métis Kin Exhibit — Launch from Windows
REM Starts the WSL servers and opens the display in your browser.
REM Double-click this file to run.

echo === Métis Kin Exhibit ===
echo Starting servers in WSL...

REM Kill any old exhibit servers first
wsl -d Ubuntu pkill -f "exhibit-server.py" 2>nul
wsl -d Ubuntu pkill -f "http.server 8082" 2>nul
timeout /t 1 /nobreak >nul

REM Start the state relay server (port 8081)
start /min wsl -d Ubuntu bash -ic "cd ~/projects/Shoebox\ V2 && python3 scripts/exhibit-server.py"

REM Start the static file server (port 8082 — NOT 8080, that's the website)
start /min wsl -d Ubuntu bash -ic "cd ~/projects/Shoebox\ V2/public && python3 -m http.server 8082"

REM Wait for servers to be ready
timeout /t 3 /nobreak >nul

REM Test the connection
curl -s http://localhost:8081/health >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: State server (8081) didn't respond.
) else (
    echo [OK] State server :8081
)

curl -s -o nul -w "%%{http_code}" http://localhost:8082/controller.html >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: Static server (8082) didn't respond.
) else (
    echo [OK] Static server :8082
)

echo.
echo Opening display in fullscreen...
start msedge --kiosk --edge-kiosk-type=fullscreen "http://localhost:8082/projector.html?exhibit&server=localhost:8081"

echo.
echo =========================================
echo   CONTROLLER URL (open on tablet):
echo   http://YOUR_WINDOWS_IP:8082/controller.html
echo.
echo   Find your IP: run ipconfig in cmd
echo   Usually 192.168.x.x
echo =========================================
echo.
echo Press any key to close all servers.
pause >nul

REM Cleanup on close
echo Stopping servers...
wsl -d Ubuntu pkill -f "exhibit-server.py" 2>nul
wsl -d Ubuntu pkill -f "http.server 8082" 2>nul
echo Done.
