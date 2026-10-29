# assets/gate

`model.tflite` and `model.json` land here when `tools/gate/export.py` runs. Until
then this folder is a promise with nothing in it, and `src/services/gate.ts`
records every gate pass as unchecked. That is the truthful state: a gate with no
eyes should not pretend it looked.
