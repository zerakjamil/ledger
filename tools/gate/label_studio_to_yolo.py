#!/usr/bin/env python3
"""Turn a label-studio JSON export into the YOLO text files Ultralytics reads.

label-studio stores boxes as percentages of the source image, which is the one
coordinate system that survives a resize. YOLO wants the box centre and size
normalised to 0..1, which is the same information in a different order. That is
the whole conversion.

    python3 tools/gate/label_studio_to_yolo.py export.json \
        --images tools/gate/data/raw/evening-1

Writes <image stem>.txt beside each image. Skips images with no boxes, but says
so, because an image with no boxes is a real negative and an image nobody
opened is a hole in the set.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Order matters: these ids are what scoresFromModel reads on the phone.
CLASSES = ["person", "dumbbell", "bench"]
CLASS_ID = {name: index for index, name in enumerate(CLASSES)}


def load_tasks(path: Path) -> list[dict]:
    data = json.loads(path.read_text())
    if isinstance(data, dict):
        return data.get("tasks", [])
    return data


def boxes_from_task(task: dict) -> list[tuple[int, float, float, float, float]]:
    boxes: list[tuple[int, float, float, float, float]] = []
    for annotation in task.get("annotations", []):
        if annotation.get("was_cancelled"):
            continue
        for result in annotation.get("result", []):
            if result.get("type") != "rectanglelabels":
                continue
            value = result.get("value", {})
            label = next(iter(value.get("rectanglelabels") or []), "")
            if label not in CLASS_ID:
                continue
            width = float(result.get("original_width") or value.get("original_width") or 0)
            height = float(result.get("original_height") or value.get("original_height") or 0)
            if width <= 0 or height <= 0:
                continue
            x = float(value.get("x", 0)) / 100.0
            y = float(value.get("y", 0)) / 100.0
            w = float(value.get("width", 0)) / 100.0
            h = float(value.get("height", 0)) / 100.0
            cx = min(1.0, max(0.0, x + w / 2))
            cy = min(1.0, max(0.0, y + h / 2))
            boxes.append((CLASS_ID[label], cx, cy, min(1.0, max(0.0, w)), min(1.0, max(0.0, h))))
    return boxes


def image_stem(task: dict) -> str:
    """label-studio prefixes uploads with an eight character hash and a dash."""
    raw = Path(str(task.get("file_upload", ""))).stem
    if len(raw) > 9 and raw[8] == "-":
        return raw[9:]
    return raw


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("export", type=Path)
    parser.add_argument("--images", type=Path, required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    tasks = load_tasks(args.export)
    written = 0
    empty: list[str] = []
    missing: list[str] = []
    counts = {name: 0 for name in CLASSES}

    for task in tasks:
        stem = image_stem(task)
        if not stem:
            continue
        matches = list(args.images.glob(f"{stem}.*"))
        if not matches:
            missing.append(stem)
            continue
        image = matches[0]
        boxes = boxes_from_task(task)
        if not boxes:
            empty.append(image.name)
            continue
        lines = []
        for class_id, cx, cy, w, h in boxes:
            if w <= 0 or h <= 0:
                continue
            lines.append(f"{class_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")
            counts[CLASSES[class_id]] += 1
        if not lines:
            continue
        if not args.dry_run:
            image.with_suffix(".txt").write_text("\n".join(lines) + "\n")
        written += 1

    print(f"label files: {written}")
    for name in CLASSES:
        print(f"  {name:<9} {counts[name]:>5}")
    if empty:
        print(f"\nno boxes in {len(empty)} image(s). These are negatives if the"
              " frame really has no person, dumbbell or bench:")
        for name in empty[:12]:
            print(f"  {name}")
    if missing:
        print(f"\n{len(missing)} task(s) have no image in {args.images}:")
        for stem in missing[:12]:
            print(f"  {stem}")
    if args.dry_run:
        print("\ndry run, nothing written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
