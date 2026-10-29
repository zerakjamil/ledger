# The gate's eyes

The phone rings at the appointment. It keeps ringing until one of two things
happens: a photograph of the user sitting at the bench with a dumbbell in hand,
or the skip token is spent. This folder builds the part that looks at the
photograph.

It is a toll booth, not a lie detector. A photograph of a photograph would pass.
A determined person would pass. That is fine, because the cost the gate imposes
is not proof, it is friction: standing up, walking to the bench, picking up the
weight, and taking the picture. The alternative has a price too, and it is
written down. What the gate removes is the free door, where the phone is silenced
and nothing at all is recorded.

## What the model is

YOLO11n, fine tuned on photographs of one room, exported to int8 TFLite at
640 square. Three classes, in this order:

| id | class    | meaning                                        |
|----|----------|------------------------------------------------|
| 0  | person   | a person, any of them                          |
| 1  | dumbbell | a dumbbell or a loose plate                    |
| 2  | bench    | the bench                                      |

`bench` is graded, never required. A one handed selfie at arm's length cannot
always hold a bench, a dumbbell and a face in one frame, and a gate that refuses
a real session because the seat is out of frame teaches the user to hate the app.
See `src/domain/gate.ts` for the thresholds and the two grades.

## Why this is not a hosted model

The app has no `INTERNET` permission. That is a product decision, not an
oversight: a ledger that works on a plane and cannot phone home is a ledger you
can trust with the number you are ashamed of. It also means the detector has to
live in the app, which means a file small enough to ship and a forward pass fast
enough to run while someone is standing in their living room.

`laya.ayewar.com` is a text model. It cannot see a photo, so it was never the
verifier. It stays out of the critical path.

## The pipeline

Each step is a file in this folder. Nothing is hidden behind a framework.

```
collect.sh              pull a shoot off the phone, dedupe it
label_studio_to_yolo.py convert a label-studio export to YOLO text
split.py                check the labels, split by shoot, write dataset.yaml
train.py                fine tune yolo11n
export.py               int8 TFLite plus a manifest of the tensor contract
probe.py                run the exported file on real photos, print detections
```

### 1. Shoot

```sh
tools/gate/collect.sh evening-1
```

The phone's own camera app, not the gate screen. Volume and variety matter more
than fidelity here, and the camera app is better at both. The shot list printed
by the script is the one that matters: the pass shot, the hand-only shot, the
weight alone, a person without a weight, the empty room, and the household
objects that look like a dumbbell from across a room.

Two hundred photographs is the floor. Three hundred is better. Vary the light,
because the gate fires at the same hour every day and that hour is not always
bright.

### 2. Label

```sh
pip install label-studio
label-studio start tools/gate/data/raw/evening-1
```

One project, three rectangle labels named exactly `person`, `dumbbell`, `bench`.
Box every instance of each in the frame. Do not box a bench that is not visible.
Do not box a bottle as a dumbbell: those bottles are already in the set as
negatives, and they are the reason the detector does not fire at a kettle.

Export as JSON, then:

```sh
python3 tools/gate/label_studio_to_yolo.py export.json --images tools/gate/data/raw/evening-1
```

### 3. Split

```sh
python3 tools/gate/split.py
```

The split is by shoot, not by photograph. Twenty frames from one burst are
almost the same picture, and splitting them across train and validation produces
a score that measures memorisation. Whole shoots go to validation, so the number
answers the only question worth asking: does this work on a night the model has
never seen.

`split.py` also checks every label file, because a bad coordinate fails twenty
minutes into training with a stack trace about tensors.

### 4. Train

```sh
python3 tools/gate/train.py --device mps      # laptop
python3 tools/gate/train.py --device 0        # CUDA box
```

Eighty epochs on a few hundred images is about ten minutes on an M-series laptop
and less on a GPU. Read the per class mAP, not the mean: a model that finds
people and benches but not dumbbells has learned the room, not the task.

### 5. Export

```sh
python3 tools/gate/export.py
python3 tools/gate/probe.py
```

The export writes `assets/gate/model.tflite` and `assets/gate/model.json`. The
manifest records the input size, the quantisation scale and zero point, the
output shape and the class order, because those are the four things the phone
must agree with or it reads noise. `probe.py` runs the exported file on real
validation photos and prints what it found, using the same decoding the app uses.

Do not skip the probe. A broken export found here costs two seconds. The same
broken export found on the phone costs a fourteen minute native build.

## On the phone

`src/services/gate.ts` is the seam. Today `scoresFromModel` returns `null`, which
means every gate pass is recorded as `unverified`: the photo is kept and the page
says nobody checked. That is the honest state of a gate without eyes, and it is
also the fallback when the model is missing or the forward pass throws, because
a lost session is the one outcome this app exists to prevent.

When the model lands, the forward pass goes in that one function. The screen
already speaks `GateVerdict`, and `src/domain/gate.test.ts` already covers every
branch, so nothing else has to move.

The runtime is `react-native-fast-tflite`, which takes a typed array and returns
one. The missing piece is JPEG to RGB, and the cheap answer is `jpeg-js` in
JavaScript: the gate takes one photograph per session, not thirty frames per
second, so a few hundred milliseconds of decoding is not a problem worth a
native module.

## What stays out of git

`tools/gate/data/` and `tools/gate/runs/` are ignored. They are photographs of a
person's living room and of the person, and a git history is the wrong place for
either. The exported `model.tflite` is committed: it is four megabytes, it
contains no photographs, and an install that cannot find it cannot open the gate.
