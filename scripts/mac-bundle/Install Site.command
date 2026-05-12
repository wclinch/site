#!/bin/bash
# Site — macOS installer.
#
# Copies the Site.app sitting alongside this script into /Applications,
# strips the macOS download-quarantine flag (com.apple.quarantine), and
# launches the application. The flag-strip is necessary because Site is
# not notarized with an Apple Developer ID; without it macOS shows a
# "Apple could not verify Site" dialog on first launch.
#
# Idempotent — running again replaces the installed copy.

set -u

HERE="$(cd -- "$(dirname -- "$0")" && pwd)"

clear
echo
echo "  SITE — installer"
echo "  ────────────────────────────────────────────"
echo

APP="$HERE/Site.app"

if [ ! -d "$APP" ]; then
  echo "  Site.app not found alongside this installer."
  echo "  Make sure the zip was fully extracted before running."
  echo
  read -n 1 -s -r -p "  Press any key to close..."
  exit 1
fi

# Close existing Site if running so we can overwrite cleanly.
pkill -f "/Applications/Site.app/Contents/MacOS/Site" >/dev/null 2>&1 && sleep 1

echo "  Copying Site.app to /Applications..."
rm -rf /Applications/Site.app
cp -R "$APP" /Applications/Site.app

echo "  Removing macOS download quarantine..."
xattr -cr /Applications/Site.app

echo "  Launching..."
open /Applications/Site.app

echo
echo "  Done. Site is now installed in /Applications."
echo

# Close this Terminal window after a beat.
sleep 1
osascript -e 'tell application "Terminal" to close (every window whose name contains "Install Site")' >/dev/null 2>&1 &
exit 0
