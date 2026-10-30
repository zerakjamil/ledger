#!/usr/bin/env python3
"""Run the exported model on real validation photos, before the rebuild.

This is the reference implementation of what the phone does: letterbox the
photo, quantise it into the input tensor, run, decode. If the numbers here are
wrong the phone would print the same wrong numbers, and finding that out costs a
fourteen minute native build instead of two seconds.

    python3 tools/gate/probe.py
    python3 tools/gate/probe.py --count 12 --min 0.3

It reads assets/gate/model.json for the tensor contract and prints the top
detections per photo, in the same class order the app uses.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
MODEL = ROOT / "assets" / "gate" / "model.tflite"
MANIFEST = ROOT / "assets" / "gate" / "model.json"
VAL = HERE / "data" / "yolo" / "images" / "val"

CLASSES = ["person", "dumbbell", "bench"]


def letterbox(image: Image.Image, size: int) -> tuple[np.ndarray, float, tuple[int, int]]:
    """Fit the photo inside a square without stretching it, pad with grey.

    Stretching a portrait selfie into a square moves every box the model learned,
    which is why the model was trained on letterboxed squares in the first place.
    """
    width, height = image.size
    gain = min(size / width, size / height)
    new = (max(1, round(width * gain)), max(1, round(height * gain)))
    resized = image.resize(new, Image.BILINEAR)
    canvas = Image.new("RGB", (size, size), (114, 114, 114))
    offset = ((size - new[0]) // 2, (size - new[1]) // 2)
    canvas.paste(resized, offset)
    return np.asarray(canvas, dtype=np.uint8), gain, offset


def decode(output: np.ndarray, min_score: float, iou: float) -> list[tuple[str, float, tuple[float, float, float, float]]]:
    """Accept either head: an NMS head of [1, n, 6] or a raw YOLO head."""
    predictions = output[0]
    if predictions.ndim == 1:
        predictions = predictions[None, :]

    # NMS head: x1, y1, x2, y2, score, class. A raw head with three classes has
    # seven columns, so six columns can only be the NMS one.
    if predictions.shape[-1] == 6:
        rows = []
        for x1, y1, x2, y2, score, class_id in predictions:
            if score < min_score:
                continue
            index = int(class_id)
            if 0 <= index < len(CLASSES):
                rows.append((CLASSES[index], float(score), (float(x1), float(y1), float(x2), float(y2))))
        return sorted(rows, key=lambda row: -row[1])[:10]

    # Raw YOLO head: 4 + classes rows, transposed.
    if predictions.shape[0] < predictions.shape[1]:
        predictions = predictions.T
    boxes = predictions[:, :4]
    scores = predictions[:, 4:]
    class_ids = scores.argmax(axis=1)
    confidence = scores.max(axis=1)

    # The head speaks centre and size; NMS speaks corners. Converting once here
    # keeps overlap() from reading a width as an x2, which silently disables
    # suppression and lets one dumbbell come back as four.
    corners = np.empty_like(boxes)
    corners[:, 0] = boxes[:, 0] - boxes[:, 2] / 2
    corners[:, 1] = boxes[:, 1] - boxes[:, 3] / 2
    corners[:, 2] = boxes[:, 0] + boxes[:, 2] / 2
    corners[:, 3] = boxes[:, 1] + boxes[:, 3] / 2

    keep: list[int] = []
    order = np.argsort(-confidence)
    for index in order:
        if confidence[index] < min_score:
            break
        if all(
            overlap(corners[index], corners[other]) < iou or class_ids[index] != class_ids[other]
            for other in keep
        ):
            keep.append(int(index))

    rows = []
    for index in keep[:10]:
        x1, y1, x2, y2 = corners[index]
        rows.append(
            (
                CLASSES[int(class_ids[index])] if int(class_ids[index]) < len(CLASSES) else "?",
                float(confidence[index]),
                (float(x1), float(y1), float(x2), float(y2)),
            )
        )
    return rows


def overlap(a: np.ndarray, b: np.ndarray) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    x1, y1 = max(ax1, bx1), max(ay1, by1)
    x2, y2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    area = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1) + max(0.0, bx2 - bx1) * max(0.0, by2 - by1) - inter
    return float(inter / area) if area > 0 else 0.0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, default=MODEL)
    parser.add_argument("--manifest", type=Path, default=MANIFEST)
    parser.add_argument("--images", type=Path, default=VAL)
    parser.add_argument("--count", type=int, default=6)
    parser.add_argument("--min", type=float, default=0.35, dest="min_score")
    parser.add_argument("--iou", type=float, default=0.45)
    args = parser.parse_args()

    if not args.model.exists() or not args.manifest.exists():
        print("no model or manifest yet. Run export.py first.", file=sys.stderr)
        return 2

    try:
        import tensorflow as tf
    except ImportError:
        print("pip install tensorflow", file=sys.stderr)
        return 2

    contract = json.loads(args.manifest.read_text())
    size = int(contract["input_size"])
    scale = float(contract.get("input_scale") or 0)
    zero = int(contract.get("input_zero_point") or 0)
    integer_input = contract["input_dtype"] in ("int8", "uint8")

    interpreter = tf.lite.Interpreter(model_path=str(args.model))
    interpreter.allocate_tensors()
    entry = interpreter.get_input_details()[0]
    output_detail = interpreter.get_output_details()[0]

    images = sorted(
        path for path in args.images.glob("*") if path.suffix.lower() in {".jpg", ".jpeg", ".png"}
    )[: args.count]
    if not images:
        print(f"no validation images in {args.images}", file=sys.stderr)
        return 2

    for path in images:
        image = Image.open(path).convert("RGB")
        tensor, _gain, _offset = letterbox(image, size)
        values = tensor.astype(np.float32) / 255.0
        if integer_input:
            signed = contract["input_dtype"] == "int8"
            quantised = values / scale + zero
            values = (np.clip(quantised, -128, 127) if signed else np.clip(quantised, 0, 255)).astype(
                np.int8 if signed else np.uint8
            )
        interpreter.set_tensor(entry["index"], values[None, ...])
        interpreter.invoke()
        raw = interpreter.get_tensor(output_detail["index"])
        rows = decode(raw, args.min_score, args.iou)
        summary = ", ".join(f"{name} {score:.2f}" for name, score, _ in rows) or "nothing above the floor"
        print(f"{path.name}: {summary}")

    print(
        "\nScores are not a verdict. Read them the way the app does: a dumbbell\n"
        "over 0.50 and a person over 0.40 opens the gate. Anything else asks the\n"
        "user to move the weight into the frame."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
