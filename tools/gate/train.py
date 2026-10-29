#!/usr/bin/env python3
"""Train the gate detector.

YOLO11n is the smallest model in the family that still finds a small object in a
wide frame. The gate is a toll booth, not an anti-cheat system, so the target is
not a high score, it is a detector that says "dumbbell, 0.71" reliably on the
one phone, in the one room, at the two times of day this app actually rings.

    python3 tools/gate/train.py
    python3 tools/gate/train.py --device 0 --epochs 120     # a CUDA box
    python3 tools/gate/train.py --device mps                # an Apple laptop

Weights land in tools/gate/runs/gate/weights/best.pt.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

HERE = Path(__file__).parent
DATASET = HERE / "data" / "yolo" / "dataset.yaml"


def frame_counts(dataset: Path) -> tuple[int, int]:
    root = dataset.parent
    def count(split: str) -> int:
        folder = root / "images" / split
        return len(list(folder.glob("*"))) if folder.exists() else 0
    return count("train"), count("val")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, default=DATASET)
    parser.add_argument("--base", default="yolo11n.pt", help="starting weights, COCO pretrained")
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--patience", type=int, default=20)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--device", default="mps", help="mps, cpu, or a CUDA index like 0")
    parser.add_argument("--name", default="gate")
    args = parser.parse_args()

    if not args.dataset.exists():
        print(f"no dataset at {args.dataset}. Run split.py first.", file=sys.stderr)
        return 2

    train_frames, val_frames = frame_counts(args.dataset)
    if train_frames < 40 or val_frames < 10:
        print(f"dataset is too thin: {train_frames} train, {val_frames} val", file=sys.stderr)
        print("the model will memorise the room instead of learning the objects", file=sys.stderr)
        return 2

    try:
        from ultralytics import YOLO
    except ImportError:
        print("pip install ultralytics", file=sys.stderr)
        return 2

    model = YOLO(args.base)
    model.train(
        data=str(args.dataset),
        epochs=args.epochs,
        patience=args.patience,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        project=str(HERE / "runs"),
        name=args.name,
        exist_ok=True,
        seed=0,
        # The phone is portrait and the room is dim. Flips are free variety;
        # rotation is not, because a dumbbell is not symmetric top to bottom and
        # a rotated one is not a photograph the camera will ever take.
        fliplr=0.5,
        flipud=0.0,
        degrees=4.0,
        hsv_v=0.5,
        hsv_s=0.5,
        scale=0.5,
        mosaic=1.0,
        close_mosaic=10,
        workers=4,
        val=True,
        plots=True,
        verbose=True,
    )

    metrics = model.val()
    print("\nmean mAP50 {:.3f}, mAP50-95 {:.3f}".format(metrics.box.map50, metrics.box.map))
    print("per class:")
    try:
        for position, class_id in enumerate(metrics.box.ap_class_index):
            print(
                "  {:<9} mAP50 {:.3f}  mAP50-95 {:.3f}".format(
                    metrics.names[int(class_id)],
                    float(metrics.box.ap50[position]),
                    float(metrics.box.maps[position]),
                )
            )
    except (AttributeError, IndexError, TypeError):
        print("  this ultralytics build reports only the mean; read the plots instead")

    best = HERE / "runs" / args.name / "weights" / "best.pt"
    print(f"\nbest weights: {best}")
    print("next: python3 tools/gate/export.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
