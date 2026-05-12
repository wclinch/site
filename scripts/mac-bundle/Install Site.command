#!/bin/bash
# Site — macOS installer.
#
# One-click install: mounts the right DMG for the current arch, copies
# Site.app into /Applications, strips the macOS download-quarantine flag,
# and launches the app. The flag-strip is necessary because Site is not
# notarized with an Apple Developer ID; without it macOS shows a hard
# "Apple could not verify Site" dialog on first launch.
#
# Idempotent — running it a second time replaces the install with a fresh
# copy from the DMG.

set -u

# Resolve our own location so the script works no matter where the user
# unzipped to. `$0` is the script path; `dirname` gives the folder.
HERE="$(cd -- "$(dirname -- "$0")" && pwd)"

clear
echo
echo "  SITE — installer"
echo "  ────────────────────────────────────────────"
echo

# Pick the DMG that matches the running CPU.
ARCH="$(uname -m)"
if [ "$ARCH" = "arm64" ]; then
  DMG="$HERE/Installers/Site-0.1.0-arm64.dmg"
  ARCH_LABEL="Apple Silicon"
else
  DMG="$HERE/Installers/Site-0.1.0.dmg"
  ARCH_LABEL="Intel"
fi

if [ ! -f "$DMG" ]; then
  echo "  Missing installer: $(basename "$DMG")"
  echo "  Make sure the zip was fully extracted before running."
  echo
  read -n 1 -s -r -p "  Press any key to close..."
  exit 1
fi

echo "  Detected: $ARCH_LABEL"
echo "  Installer: $(basename "$DMG")"
echo

# Close any running Site so we can overwrite cleanly.
pkill -f "/Applications/Site.app/Contents/MacOS/Site" >/dev/null 2>&1 && sleep 1

echo "  Mounting disk image..."
# Detach any previously-mounted Site volume so our lookup picks the new one
for vol in /Volumes/Site*; do
  [ -d "$vol" ] && hdiutil detach "$vol" -quiet >/dev/null 2>&1 || true
done

if ! hdiutil attach -nobrowse -noverify -quiet "$DMG"; then
  echo "  Mount failed."
  read -n 1 -s -r -p "  Press any key to close..."
  exit 1
fi

# DMG mounts to /Volumes/Site* — find the freshly-mounted volume that
# contains Site.app. Parsing hdiutil output directly is brittle because
# volume names contain spaces; globbing /Volumes is the reliable path.
VOL=""
for v in /Volumes/Site*; do
  if [ -d "$v/Site.app" ]; then VOL="$v"; break; fi
done

if [ -z "$VOL" ]; then
  echo "  Could not find Site.app on the mounted disk image."
  read -n 1 -s -r -p "  Press any key to close..."
  exit 1
fi

echo "  Installing to /Applications..."
rm -rf /Applications/Site.app
cp -R "$VOL/Site.app" /Applications/Site.app

echo "  Ejecting disk image..."
hdiutil detach "$VOL" -quiet >/dev/null 2>&1 || true

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
