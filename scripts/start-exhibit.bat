@echo off
REM Métis Kin Exhibit — Launch from Windows
REM Starts the WSL servers and opens the display in your browser.
REM Place this on the Windows desktop and double-click to run.

echo === Métis Kin Exhibit ===
echo Starting servers in WSL...

REM Start the state server and static server in WSL
wsl -d Ubuntu --cd ~/projects/Shoebox\ V2 -- python3 scripts/exhibit-server.py &
wsl -d Ubuntu --cd ~/projects/Shoebox\ V2/public -- python3 -m http.server 8080 &

REM Wait for servers to be ready
timeout /t 3 /nobreak >nul

REM Test the connection
curl -s http://localhost:8081/health >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: State server didn't respond. Check WSL is running.
) else (
    echo State server OK
)

curl -s -o nul -w "%%{http_code}" http://localhost:8080/ >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: Static server didn't respond.
) else (
    echo Static server OK
)

echo.
echo Opening display...
start msedge --kiosk --edge-kiosk-type=fullscreen "http://localhost:8080/projector.html?exhibit&server=localhost:8081"

echo.
echo Controller URL (open on tablet):
echo   http://localhost:8080/controller.html
echo.
pause
