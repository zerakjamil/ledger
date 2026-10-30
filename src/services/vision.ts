import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * The bridge to the one native piece in the app.
 *
 * It is optional on purpose: `npx expo start` in a client without the module
 * must still run every other page, and the gate must be able to say "no
 * detector" instead of crashing on import.
 */
export interface VisionInput {
  width: number;
  height: number;
  channels: number;
  dtype: 'float32' | 'uint8';
  /** Pixels of grey added on each side by the letterbox. */
  padX: number;
  padY: number;
  /** Model pixels per image pixel. */
  ratio: number;
}

export interface VisionOutput {
  name: string;
  shape: number[];
  dtype: 'float32' | 'uint8';
  data: Uint8Array;
}

export interface VisionRun {
  input: VisionInput;
  outputs: VisionOutput[];
  /** Decode, letterbox and forward pass, in milliseconds. */
  ms: number;
}

interface NativeVision {
  available(): boolean;
  infer(modelPath: string, imagePath: string, threads: number): Promise<VisionRun>;
}

const native = requireOptionalNativeModule<NativeVision>('GateVision');

export function visionAvailable(): boolean {
  return native != null;
}

export async function infer(modelPath: string, imagePath: string, threads = 2): Promise<VisionRun> {
  if (!native) throw new Error('The vision module is not in this build.');
  return native.infer(modelPath, imagePath, threads);
}

/** The float view of a raw output tensor, copied out of the bridge's bytes. */
export function floats(output: VisionOutput): Float32Array {
  if (output.dtype !== 'float32') throw new Error('not a float32 tensor');
  const copy = new Uint8Array(output.data.byteLength);
  copy.set(output.data);
  return new Float32Array(copy.buffer);
}

/**
 * Native errors arrive wrapped: "Call to function 'GateVision.infer' has been
 * rejected. Caused by: java.lang.IllegalStateException: no bundled model". The
 * sentence the user needs is at the end of that, and the bridge's plumbing is
 * not their problem.
 */
export function reason(error: unknown): string {
  const text = String((error as Error)?.message ?? error);
  if (text.includes('no bundled model')) return 'No model is bundled in this build.';
  if (text.includes('did not load')) return 'The bundled model would not load.';
  if (text.includes('not an image')) return 'That photo could not be read.';
  if (text.includes('no such photo')) return 'The gate photo is gone.';
  const cause = text.split('Caused by:').pop()?.replace(/^\s*→?\s*/, '').trim();
  return cause || text;
}
