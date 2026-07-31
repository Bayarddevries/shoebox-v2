#!/bin/bash
# Métis Kin Exhibit — Launch Script
# Starts the state relay server + static file server for the exhibit.
#
# Usage:
#   ./exhibit-start.sh               # Servers only (browsers open manually)
#   ./exhibit-start.sh --display      # Server + big screen browser in kiosk mode
#   ./exhibit-start.sh --controller   # Server + open controller page
#   ./exhibit-start.sh --all          # Everything

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PUBLIC_DIR="$PROJECT_DIR/public"
STATE_PORT=8081
STATIC_PORT=8082

echo "=== Métis Kin Exhibit ==="

# Kill existing processes on our ports
for port in $STATE_PORT $STATIC_PORT; do
  PID=$(lsof -ti:$port 2>/dev/null)
  if [ -n "$PID" ]; then
    echo "Killing process on port $port (PID $PID)..."
    kill $PID 2>/dev/null; sleep 1
  fi
done

# Start the state server
echo "Starting state server on port $STATE_PORT..."
python3 "$SCRIPT_DIR/exhibit-server.py" &
STATE_PID=$!
sleep 2

# Start the static file server (no-cache so phones always get fresh HTML)
echo "Starting static server on port $STATIC_PORT..."
python3 "$SCRIPT_DIR/serve-exhibit.py" &
STATIC_PID=$!
sleep 1

# Verify servers
echo "Checking servers..."
STATE_OK=$(curl -s http://localhost:$STATE_PORT/health > /dev/null 2>&1 && echo "OK" || echo "FAIL")
STATIC_OK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$STATIC_PORT/ | grep -q 200 && echo "OK" || echo "FAIL")
echo "  State server (:$STATE_PORT):  $STATE_OK"
echo "  Static server (:$STATIC_PORT): $STATIC_OK"

DISP_URL="http://localhost:$STATIC_PORT/projector.html?exhibit&server=localhost:$STATE_PORT"
CTRL_URL="http://localhost:$STATIC_PORT/controller.html"

# Open display (big screen) in kiosk mode
if [[ "$1" == "--display" || "$1" == "--all" ]]; then
  echo "Opening display (kiosk)..."
  if command -v chromium-browser &> /dev/null; then
    chromium-browser --kiosk --app="$DISP_URL" --noerrdialogs --disable-session-crashed-bubble &
  elif command -v chromium &> /dev/null; then
    chromium --kiosk --app="$DISP_URL" --noerrdialogs --disable-session-crashed-bubble &
  else
    echo "  No Chromium found. Open in browser:"
    echo "  $DISP_URL"
  fi
fi

# Open controller page for testing
if [[ "$1" == "--controller" || "$1" == "--all" ]]; then
  echo "Opening controller..."
  if command -v xdg-open &> /dev/null; then
    xdg-open "$CTRL_URL"
  else
    echo "  Open in browser:"
    echo "  $CTRL_URL"
  fi
fi

echo ""
echo "Exhibit running. Press Ctrl+C to stop all processes."
echo ""
echo "  Display:       $DISP_URL"
echo "  Controller:    $CTRL_URL"
echo "  State API:     http://localhost:$STATE_PORT"

trap "echo 'Stopping...'; kill $STATE_PID $STATIC_PID 2>/dev/null; exit 0" INT TERM
wait
