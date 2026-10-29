#!/usr/bin/env python3
"""Build a YOLO dataset from the shoots, and check it before it wastes an hour.

The split is by shoot, not by photograph. Frames from one burst are nearly the
same picture; splitting them randomly puts the validation set one step away from
the training set and reports a number that means nothing. Whole shoots go to
validation, so the score answers the only question that matters: does this work
on a night the model has not seen.

    python3 tools/gate/split.py
    python3 tools/gate/split.py --val-shoots evening-3

Labels are checked here rather than inside the training loop, because a bad
label file fails twenty minutes in with a stack trace about tensors.
"""

from __future__ import annotations

import argparse
import random
import shutil
import sys
from pathlib import Path

CLASSES = ["person", "dumbbell", "bench"]
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"}


def images_in(folder: Path) -> list[Path]:
    return sorted(p for p in folder.iterdir() if p.is_file() and p.suffix in IMAGE_EXT)


def read_label(path: Path) -> list[tuple[int, float, float, float, float]]:
    rows = []
    for number, line in enumerate(path.read_text().splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) != 5:
            raise ValueError(f"{path}:{number} has {len(parts)} fields, expected 5")
        class_id = int(parts[0])
        cx, cy, w, h = (float(value) for value in parts[1:])
        if not 0 <= class_id < len(CLASSES):
            raise ValueError(f"{path}:{number} class {class_id} is not one of {CLASSES}")
        if not all(0.0 <= value <= 1.0 for value in (cx, cy, w, h)):
            raise ValueError(f"{path}:{number} has a coordinate outside 0..1")
        if w <= 0.001 or h <= 0.001:
            raise ValueError(f"{path}:{number} has an empty box")
        rows.append((class_id, cx, cy, w, h))
    return rows


def link(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() or target.is_symlink():
        target.unlink()
    target.symlink_to(source.resolve())


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw", type=Path, default=Path(__file__).parent / "data" / "raw")
    parser.add_argument("--out", type=Path, default=Path(__file__).parent / "data" / "yolo")
    parser.add_argument("--val-shoots", nargs="*", default=None)
    parser.add_argument("--val-fraction", type=float, default=0.25)
    parser.add_argument(
        "--negatives",
        nargs="*",
        default=[],
        help="shoots that are deliberately all negatives, so an empty label is correct",
    )
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    shoots = sorted(p for p in args.raw.iterdir() if p.is_dir()) if args.raw.exists() else []
    if not shoots:
        print(f"no shoots under {args.raw}. Run collect.sh first.", file=sys.stderr)
        return 2

    labelled = {shoot: images_in(shoot) for shoot in shoots}
    allowed_empty = set(args.negatives)
    unlabelled = [
        shoot
        for shoot, files in labelled.items()
        if shoot.name not in allowed_empty and not any(f.with_suffix(".txt").exists() for f in files)
    ]
    if unlabelled:
        print("these shoots have no .txt files at all, so they were never labelled:", file=sys.stderr)
        for shoot in unlabelled:
            print(f"  {shoot.name}", file=sys.stderr)
        print("\nif a shoot really is all negatives (the empty room), pass --negatives <shoot>", file=sys.stderr)
        return 2

    if args.val_shoots:
        val_names = set(args.val_shoots)
        unknown = val_names - {shoot.name for shoot in shoots}
        if unknown:
            print(f"unknown shoot(s): {sorted(unknown)}", file=sys.stderr)
            return 2
    else:
        if len(shoots) == 1:
            print(
                "only one shoot exists, so validation will use frames from the same\n"
                "session and the score will be optimistic. Shoot a second night before\n"
                "believing any number this prints.",
                file=sys.stderr,
            )
        shuffled = shoots[:]
        random.Random(args.seed).shuffle(shuffled)
        take = max(1, round(len(shuffled) * args.val_fraction))
        val_names = {shoot.name for shoot in shuffled[:take]}

    if args.out.exists():
        shutil.rmtree(args.out)

    totals = {"train": {name: 0 for name in CLASSES}, "val": {name: 0 for name in CLASSES}}
    frames = {"train": 0, "val": 0}
    problems: list[str] = []

    for shoot in shoots:
        split = "val" if shoot.name in val_names else "train"
        for image in labelled[shoot]:
            label = image.with_suffix(".txt")
            try:
                rows = read_label(label) if label.exists() else []
            except ValueError as error:
                problems.append(str(error))
                continue
            link(image, args.out / "images" / split / image.name)
            written = args.out / "labels" / split / f"{image.stem}.txt"
            written.parent.mkdir(parents=True, exist_ok=True)
            written.write_text("".join(f"{c} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}\n" for c, cx, cy, w, h in rows))
            frames[split] += 1
            for class_id, *_ in rows:
                totals[split][CLASSES[class_id]] += 1

    if problems:
        print(f"\n{len(problems)} bad label file(s):", file=sys.stderr)
        for problem in problems[:20]:
            print(f"  {problem}", file=sys.stderr)
        return 1

    for split in ("train", "val"):
        print(f"{split}: {frames[split]} frames")
        for name in CLASSES:
            print(f"  {name:<9} {totals[split][name]:>5} boxes")

    if totals["val"]["dumbbell"] < 15:
        print(
            "\nwarning: fewer than fifteen dumbbells in validation. One missed box\n"
            "will swing the score by several points, so add a shoot.",
            file=sys.stderr,
        )

    yaml_path = args.out / "dataset.yaml"
    yaml_path.write_text(
        f"path: {args.out.resolve()}\n"
        "train: images/train\n"
        "val: images/val\n"
        "names:\n" + "".join(f"  {index}: {name}\n" for index, name in enumerate(CLASSES))
    )
    print(f"\nwrote {yaml_path}")
    print(f"val shoots: {', '.join(sorted(val_names))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
