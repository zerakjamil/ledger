#!/usr/bin/env python3
"""Export the trained detector for the phone, then prove it still works.

The phone gets an int8 TFLite file. Not because the model needs to be small, but
because a 4 MB model inside an app is a file, and a 50 MB one is a reason not to
install the update.

    python3 tools/gate/export.py
    python3 tools/gate/export.py --no-nms       # raw boxes, decode on the phone

Writes assets/gate/model.tflite and assets/gate/model.json. The manifest is not
decoration: it records the input size, the quantisation, the output shape and
the class order, which are the four things the phone has to agree with or it
reads garbage.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
WEIGHTS = HERE / "runs" / "gate" / "weights" / "best.pt"
DATASET = HERE / "data" / "yolo" / "dataset.yaml"
OUT = ROOT / "assets" / "gate"

CLASSES = ["person", "dumbbell", "bench"]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--weights", type=Path, default=WEIGHTS)
    parser.add_argument("--dataset", type=Path, default=DATASET)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--nms", action="store_true", default=True)
    parser.add_argument("--no-nms", dest="nms", action="store_false")
    parser.add_argument("--calib", type=int, default=150, help="images used to calibrate int8")
    args = parser.parse_args()

    if not args.weights.exists():
        print(f"no weights at {args.weights}. Run train.py first.", file=sys.stderr)
        return 2
    if not args.dataset.exists():
        print(f"no dataset at {args.dataset}. int8 calibration needs real images.", file=sys.stderr)
        return 2

    try:
        from ultralytics import YOLO
    except ImportError:
        print("pip install ultralytics onnx onnx2tf tensorflow", file=sys.stderr)
        return 2

    model = YOLO(str(args.weights))
    exported = model.export(
        format="tflite",
        imgsz=args.imgsz,
        int8=True,
        data=str(args.dataset),
        nms=args.nms,
        # One photo is taken at a time, so a batch of one keeps the graph and the
        # input tensor the phone allocates as small as they can be.
        batch=1,
    )
    source = Path(exported)
    if not source.exists():
        print(f"export said {source}, but nothing is there", file=sys.stderr)
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / "model.tflite"
    shutil.copyfile(source, target)
    size_mb = target.stat().st_size / (1024 * 1024)
    print(f"wrote {target} ({size_mb:.2f} MB)")
    if size_mb > 12:
        print("warning: this is larger than an int8 YOLO11n should be", file=sys.stderr)

    manifest = describe(target, args.imgsz, args.nms)
    if manifest is None:
        print("could not read the tflite tensors. Install tensorflow to verify.", file=sys.stderr)
        return 1
    (OUT / "model.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))

    if manifest["output_shape"] and manifest["output_shape"][-1] not in (6, 7, 84, 4 + len(CLASSES)):
        print(
            "warning: unexpected output width {}. The phone decoder assumes a"
            " YOLO11 head or an NMS head.".format(manifest["output_shape"][-1]),
            file=sys.stderr,
        )
    return 0


def describe(path: Path, imgsz: int, nms: bool) -> dict | None:
    """Read the tensor contract back out of the file, so the app can trust it."""
    try:
        import numpy as np
        import tensorflow as tf
    except ImportError:
        return None

    interpreter = tf.lite.Interpreter(model_path=str(path))
    interpreter.allocate_tensors()
    inputs = interpreter.get_input_details()
    outputs = interpreter.get_output_details()
    entry = inputs[0]
    out = outputs[0]
    scale, zero = entry["quantization"]
    return {
        "input_size": int(entry["shape"][1]) if entry["shape"][1] else imgsz,
        "input_shape": [int(value) for value in entry["shape"]],
        "input_dtype": str(np.dtype(entry["dtype"]).name),
        "input_scale": float(scale),
        "input_zero_point": int(zero),
        "output_shape": [int(value) for value in out["shape"]],
        "output_dtype": str(np.dtype(out["dtype"]).name),
        "output_scale": float(out["quantization"][0]),
        "output_zero_point": int(out["quantization"][1]),
        "nms": bool(nms),
        "classes": CLASSES,
        "imgsz": imgsz,
    }


if __name__ == "__main__":
    sys.exit(main())
