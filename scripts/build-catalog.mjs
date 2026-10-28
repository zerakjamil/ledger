import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

/**
 * Build the movement shelf from the exercises-dataset clone.
 *
 * The app bundles the result, so this runs once (or when the source dataset
 * changes), not at app build time. Media is © Gym visual and is bundled for
 * this phone only; see docs/ASSETS.md.
 *
 *   DATASET_DIR=../exercises-dataset node scripts/build-catalog.mjs
 *
 * Output:
 *   assets/catalog/<id>.gif   180x180 duotone loop
 *   assets/catalog/<id>.png   first frame, for the list
 *   src/data/catalog.json     the records the app reads
 *   src/data/catalog-art.ts   static require() map (Metro needs literals)
 */

const DATASET = process.env.DATASET_DIR;
if (!DATASET) {
  console.error('Set DATASET_DIR to the exercises-dataset clone.');
  process.exit(1);
}

const ROOT = process.cwd();
const ASSETS = path.join(ROOT, 'assets', 'catalog');
const DATA = path.join(ROOT, 'src', 'data');
const FORCE = process.argv.includes('--force');

const KIT = new Set(['dumbbell', 'barbell', 'body weight', 'weighted']);

/** Movements this room cannot do, or that need a bar or ball it does not have. */
const IMPOSSIBLE =
  /(pull[ -]?ups?|chin[ -]?ups?|muscle[ -]?up|\bdips?\b|hanging|inverted row|handstand|planche|front lever|back lever|\brings?\b|\brope\b|sled|machine|smith|\blever\b|\bpov\b|parallel bars|exercise ball|stability ball|swiss ball|bosu|arm blaster|suspended)/i;

/** A barbell one-arm lift breaks the bar-weight arithmetic. */
const ONE_ARM_BARBELL = /^barbell .*(one|single)[- ]arm/i;

/**
 * Cannot be unracked without a rack. The room has none, so these stay on the
 * shelf as reference but cannot take a slot. Matched exactly: a loose regex
 * also tagged "Barbell squat (on knees)" and "Barbell squat jump step rear
 * lunge", which are both floor movements.
 */
const NEEDS_RACK = new Set([
  'barbell bench press',
  'barbell close-grip bench press',
  'barbell decline bench press',
  'barbell guillotine bench press',
  'barbell incline bench press',
  'barbell jm bench press',
  'barbell wide bench press',
  'barbell reverse grip decline bench press',
  'barbell reverse grip incline bench press',
  'barbell wide reverse grip bench press',
  'barbell incline close grip bench press',
  'barbell reverse close-grip bench press',
  'barbell bench squat',
  'barbell full squat',
  'barbell hack squat',
  'barbell high bar squat',
  'barbell low bar squat',
  'barbell narrow stance squat',
  'barbell speed squat',
  'barbell wide squat',
]);

const DUPE = /\((male|female)\)|\s+v\.\s*2\b/i;

function cleanName(name) {
  return name
    .replace(/_/g, ' ')
    .replace(/\s*\((male|female)\)\s*/gi, ' ')
    .replace(/\s+\b(male|female)\b\s*$/i, '')
    .replace(/\s+v\.\s*\d+\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function displayName(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim().slice(0, 300) || `exit ${code}`));
    });
  });
}

async function pool(items, limit, worker) {
  let index = 0;
  const runners = Array.from({ length: limit }, async () => {
    while (index < items.length) {
      const item = items[index++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

const source = JSON.parse(fs.readFileSync(path.join(DATASET, 'data', 'exercises.json'), 'utf8'));

const seen = new Set();
const kept = [];
const dropped = { kit: 0, impossible: 0, oneArmBar: 0, duplicate: 0, noSteps: 0 };

for (const record of source) {
  if (!KIT.has(record.equipment)) {
    dropped.kit += 1;
    continue;
  }
  if (IMPOSSIBLE.test(record.name)) {
    dropped.impossible += 1;
    continue;
  }
  if (ONE_ARM_BARBELL.test(record.name)) {
    dropped.oneArmBar += 1;
    continue;
  }
  const name = cleanName(record.name);
  if (seen.has(name.toLowerCase())) {
    dropped.duplicate += 1;
    continue;
  }
  const steps = record.instruction_steps?.en ?? [];
  if (steps.length === 0) {
    dropped.noSteps += 1;
    continue;
  }
  seen.add(name.toLowerCase());
  kept.push({
    id: record.id,
    name: displayName(name),
    equipment: record.equipment,
    bodyPart: record.body_part,
    target: record.target,
    secondary: record.secondary_muscles ?? [],
    steps,
    needsRack: NEEDS_RACK.has(name.toLowerCase()),
    sourceGif: record.gif_url,
  });
}

fs.mkdirSync(ASSETS, { recursive: true });
fs.mkdirSync(DATA, { recursive: true });

console.log(`${kept.length} movements kept`, dropped);

const converted = [];
const failed = [];

await pool(kept, 8, async (record) => {
  const gif = path.join(ASSETS, `${record.id}.gif`);
  /**
   * Android flattens res/drawable names and drops the extension, so 1760.gif
   * and 1760.png become the same resource and the merger fails. The still gets
   * its own basename.
   */
  const png = path.join(ASSETS, `${record.id}-still.png`);
  if (!FORCE && fs.existsSync(gif)) {
    /**
     * The loop is already made. Only re-extract a missing still, so fixing a
     * naming mistake does not re-encode all 651 GIFs.
     */
    if (!fs.existsSync(png)) {
      try {
        await run('magick', [`${gif}[0]`, '-strip', png]);
      } catch (cause) {
        failed.push({ id: record.id, why: String(cause).slice(0, 120) });
        return;
      }
    }
    converted.push(record);
    return;
  }
  const src = path.join(DATASET, record.sourceGif);
  if (!fs.existsSync(src)) {
    failed.push({ id: record.id, why: 'missing source' });
    return;
  }
  try {
    await run('magick', [
      src,
      '-coalesce',
      '-resize',
      '180x180',
      '-filter',
      'Lanczos',
      '-colorspace',
      'Gray',
      '-level',
      '5%,95%',
      '+level-colors',
      '#3A332B,#F6F2E9',
      '-colors',
      '16',
      '-dither',
      'None',
      '-strip',
      '-layers',
      'Optimize',
      gif,
    ]);
    await run('magick', [`${gif}[0]`, '-strip', png]);
    converted.push(record);
  } catch (cause) {
    failed.push({ id: record.id, why: String(cause).slice(0, 120) });
  }
});

if (failed.length > 0) {
  console.log(`${failed.length} failed`, failed.slice(0, 8));
}

converted.sort((a, b) => a.id.localeCompare(b.id));

const records = converted.map((record) => ({
  id: record.id,
  name: record.name,
  equipment: record.equipment,
  bodyPart: record.bodyPart,
  target: record.target,
  secondary: record.secondary,
  steps: record.steps,
  needsRack: record.needsRack,
}));

fs.writeFileSync(path.join(DATA, 'catalog.json'), JSON.stringify(records));

const art = [
  "import type { ImageSourcePropType } from 'react-native';",
  '',
  '/**',
  ' * Generated by scripts/build-catalog.mjs. Do not edit by hand.',
  ' *',
  ' * 180x180 duotone loops and their first frame. The list uses the still, so',
  ' * scrolling never runs hundreds of GIFs at once; the detail runs one.',
  ' */',
  'export const CATALOG_PLATES: Record<string, ImageSourcePropType> = {',
  ...records.map((r) => `  'cat-${r.id}': require('../../assets/catalog/${r.id}.gif'),`),
  '};',
  '',
  'export const CATALOG_THUMBS: Record<string, ImageSourcePropType> = {',
  ...records.map((r) => `  'cat-${r.id}': require('../../assets/catalog/${r.id}-still.png'),`),
  '};',
  '',
  'export function catalogPlate(id: string): ImageSourcePropType | null {',
  '  return CATALOG_PLATES[id] ?? null;',
  '}',
  '',
  'export function catalogThumb(id: string): ImageSourcePropType | null {',
  '  return CATALOG_THUMBS[id] ?? null;',
  '}',
  '',
];
fs.writeFileSync(path.join(DATA, 'catalog-art.ts'), art.join('\n'));

let bytes = 0;
for (const record of records) {
  bytes += fs.statSync(path.join(ASSETS, `${record.id}.gif`)).size;
  bytes += fs.statSync(path.join(ASSETS, `${record.id}-still.png`)).size;
}

console.log(
  `${records.length} written, ${(bytes / 1024 / 1024).toFixed(1)} MB of art, ${(fs.statSync(path.join(DATA, 'catalog.json')).size / 1024).toFixed(0)} KB of data`,
);
