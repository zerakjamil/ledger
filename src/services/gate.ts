import { Directory, File, Paths } from 'expo-file-system';
import { judge, unavailable, type GateScores, type GateVerdict } from '../domain/gate';

/**
 * Where the receipts live. One file a day, so the review page can put the face
 * next to the number: a gate that leaves no trace is a gate that can be passed
 * by walking past the phone.
 */
const FOLDER = 'gate';

export async function keep(uri: string, day: string): Promise<string | null> {
  try {
    const folder = new Directory(Paths.document, FOLDER);
    if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
    const name = `${day}.jpg`;
    const target = new File(folder, name);
    if (target.exists) target.delete();
    /**
     * Waited on, not fired and forgotten. The event that follows this writes the
     * filename, and a receipt that is still being copied when the review asks
     * for it is a broken image on the one page that is meant to be evidence.
     */
    await new File(uri).copy(target);
    return name;
  } catch {
    /**
     * A photo that could not be filed is still a photo that was taken. The gate
     * opens, the page records no receipt, and nothing about a full disk is
     * allowed to cancel a session.
     */
    return null;
  }
}

export function receipt(name: string | null): File | null {
  if (!name) return null;
  try {
    const file = new File(Paths.document, FOLDER, name);
    return file.exists ? file : null;
  } catch {
    return null;
  }
}

/**
 * The newest photo the gate kept, for the diagnostic in Settings. It is the
 * photo the model will actually see, not a stock image: a detector tested on a
 * picture of a cat is a detector tested on nothing that matters.
 */
export async function latestReceipt(): Promise<string | null> {
  try {
    const folder = new Directory(Paths.document, FOLDER);
    if (!folder.exists) return null;
    const photos = folder
      .list()
      .filter((entry): entry is File => entry instanceof File && entry.name.endsWith('.jpg'))
      .sort((a, b) => b.name.localeCompare(a.name));
    return photos[0]?.uri ?? null;
  } catch {
    return null;
  }
}

/**
 * Takes the receipt away. The undo is not a label change: a photo left on disk
 * is a photo the review page can still show, and a pass that was taken back
 * must not keep its evidence.
 */
export async function forget(day: string): Promise<void> {
  try {
    const target = new File(new Directory(Paths.document, FOLDER), `${day}.jpg`);
    if (target.exists) target.delete();
  } catch {
    // No receipt, nothing to forget.
  }
}

/**
 * The detector.
 *
 * Nothing is bundled yet: the model has to be trained on photographs of this
 * room, which is a job for a weekend and a few hundred frames. Until then the
 * gate is an honest ceremony and the page says it was unchecked, because a
 * verdict invented by a placeholder is worse than no verdict at all.
 *
 * When the int8 model lands it goes here, and only here: the screen already
 * speaks in GateVerdict, and the tests already cover every branch.
 */
export async function read(_uri: string): Promise<GateVerdict> {
  const scores = await scoresFromModel(_uri);
  return scores ? judge(scores) : unavailable();
}

/**
 * Swapped for a real forward pass when `assets/gate/model.tflite` exists. Kept
 * separate so the trading of confidence for a pass is one function to argue
 * with, and so the tests never need a native runtime.
 */
async function scoresFromModel(_uri: string): Promise<GateScores | null> {
  return null;
}

/**
 * The screen asks this before the photo, not after. A gate that only admits it
 * was blind once you have already taken the picture is a gate that let you
 * believe it was watching.
 */
export function detectorInstalled(): boolean {
  return false;
}
