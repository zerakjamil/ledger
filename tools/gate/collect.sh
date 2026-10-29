#!/usr/bin/env bash
#
# Pull a shoot off the phone and file it.
#
# The gate does not need a dataset in the abstract. It needs photographs of one
# room, under the lights that room actually has, on the phone that will take the
# gate photo. There is no download that supplies this.
#
# Usage:
#   tools/gate/collect.sh evening-1
#   tools/gate/collect.sh evening-1 --from ~/Desktop/shoot
#
# Photos are deduplicated across shoots by content hash, so re-running is safe
# and a photo that was pulled last week is not pulled twice.

set -euo pipefail

SHOOT="${1:-}"
if [ -z "$SHOOT" ]; then
  echo "usage: tools/gate/collect.sh <shoot-name> [--from <dir>]" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")" && pwd)"
RAW="$ROOT/data/raw"
DEST="$RAW/$SHOOT"
SEEN="$ROOT/data/.seen"
mkdir -p "$DEST" "$SEEN"

SOURCE=""
if [ "${2:-}" = "--from" ]; then
  SOURCE="${3:-}"
  if [ -z "$SOURCE" ] || [ ! -d "$SOURCE" ]; then
    echo "no such folder: ${3:-}" >&2
    exit 2
  fi
fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

if [ -n "$SOURCE" ]; then
  cp "$SOURCE"/*.{jpg,jpeg,JPG,JPEG,png,PNG} "$STAGE"/ 2>/dev/null || true
else
  if ! command -v adb >/dev/null 2>&1; then
    echo "adb is not on PATH. Pass --from <dir> to use a local folder instead." >&2
    exit 2
  fi
  # The phone's own camera app, not Ledger's gate: the shoot is about volume and
  # variety, and a camera app already does that better than a form.
  adb pull /sdcard/DCIM/Camera "$STAGE/camera"
  find "$STAGE/camera" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) -exec mv {} "$STAGE"/ \;
fi

ADDED=0
DUPES=0
for file in "$STAGE"/*; do
  [ -f "$file" ] || continue
  case "$(basename "$file" | tr '[:upper:]' '[:lower:]')" in
    *.jpg|*.jpeg|*.png) ;;
    *) continue ;;
  esac
  HASH="$(shasum -a 256 "$file" | cut -d' ' -f1)"
  if [ -f "$SEEN/$HASH" ]; then
    DUPES=$((DUPES + 1))
    continue
  fi
  touch "$SEEN/$HASH"
  COUNT=$((ADDED + 1))
  EXT="$(printf '%s' "${file##*.}" | tr '[:upper:]' '[:lower:]')"
  cp "$file" "$DEST/$(printf '%04d' "$COUNT").$EXT"
  ADDED=$((ADDED + 1))
done

TOTAL="$(find "$RAW" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) | wc -l | tr -d ' ')"
echo "shoot $SHOOT: $ADDED new, $DUPES already counted, $TOTAL in total"

if [ "$TOTAL" -lt 200 ]; then
  cat <<'CHECKLIST'
A shoot is only useful if it is not one shot repeated. The list that matches
the three classes and the room:
  35  on the bench, dumbbell in hand, face in frame      (the pass shot)
  35  dumbbell in hand, bench out of frame               (the hand grade)
  35  dumbbell on the bench or the floor, nobody in shot
  35  a person standing in the room, no dumbbell         (teaches the difference)
  30  the empty room, light on and light off
  30  things that look like a dumbbell from across the room:
      bottles, a kettle, shoes, a chair leg, a black bag, a rolled mat
Vary the light across all of them: ceiling on, ceiling off, phone torch,
daylight, and at least ten shots at the exact distance you would hold the
phone for a selfie.
CHECKLIST
fi

cat <<'NEXT'
Next: label them. label-studio is the fastest tool that already exists:

  pip install label-studio
  label-studio start tools/gate/data/raw/<shoot>

Create a project with three rectangle labels named person, dumbbell, bench.
Label every dumbbell and every bench in the frame, and every person. Do not box
a bench you cannot see. Then export as JSON and convert:

  python3 tools/gate/label_studio_to_yolo.py export.json --images tools/gate/data/raw/<shoot>
NEXT
