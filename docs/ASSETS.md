# Exercise imagery

## What ships

Eleven movements, one looping demonstration each, bundled in the APK:

| Where | |
|---|---|
| Files | `assets/movements/<movement>.gif` |
| Weight | 1.6 MB for all 11 |
| Size | 450 × 450, twelve frames, 24-colour duotone |
| Colour | `#3A332B` ink on `#F6F2E9` paper, the exact page colour |
| Seen on | the form page (`/form/[id]`), reached by tapping a movement on the home page or *See the position* in a session |
| Attribution | the foot of the form page and the shelf, and the bottom of Settings |

The duotone is doing real work here. The source loops are 3D renders on a white
studio background. Mapped to the two page tones, that white becomes
`#F6F2E9` — pixel-identical to `color.paper` — so there is no frame, no card and
no visible rectangle. The figure simply sits on the paper like a plate inked
into it. Verified by sampling the rendered screenshot: the pixel inside the
image and the pixel outside it are both `srgb(246,242,233)`.

## Where it comes from

`github.com/hasaneyldrm/exercises-dataset` — 1,324 exercises, an animated GIF and
a 180 × 180 still for each, with equipment and muscle metadata.

**The media is not open.** Every record in the dataset carries:

```
"attribution": "© Gym visual — https://gymvisual.com/"
```

and the repository's `NOTICE.md` says cloning it grants no licence to the media.
This build bundles them because it is a personal app on one phone that will never
be distributed. That is the whole of the permission being relied on here.

**If this app ever leaves that phone, these files must be replaced first.**
Either buy the set at [gymvisual.com](https://gymvisual.com/) or swap in the
Unlicense stills from `github.com/yuhonas/free-exercise-db`, which is what this
app shipped before the loops and which `git log` still has.

| Movement id | Dataset folder | Note |
|---|---|---|
| `split-squat` | `0410` dumbbell single leg split squat | demo keeps the back foot down |
| `db-bench` | `0289` dumbbell bench press | exact |
| `one-arm-row` | `0292` dumbbell one arm bent-over row | free hand on a bench, same as the plan |
| `suitcase-carry` | `2133` farmers walk | demo carries two |
| `barbell-ohp` | `1456` barbell standing close grip military press | grip is a little narrower |
| `pushup-feet` | `0279` decline push-up | demo uses a box |
| `front-squat` | `0029` barbell clean-grip front squat | exact |
| `plank` | `2135` weighted front plank | demo wears a plate |
| `sl-rdl` | `1757` dumbbell single leg deadlift | exact |
| `hip-thrust` | `3562` barbell glute bridge two legs on bench | filed under glute bridge |
| `dead-bug` | `0276` dead bug | exact |

Where the demo is a neighbouring variation, the form page says so in one line
(`src/ui/movementArt.ts`, `DEMO_NOTES`). A loop that quietly teaches the wrong
setup is worse than no loop.

## The movement shelf (651)

The same repository supplies the shelf: every movement the room can load, with
search, a still in the list and one loop on the detail page.

| Where | |
|---|---|
| Data | `src/data/catalog.json`, 651 records, 406 KB |
| Art | `assets/catalog/<dataset id>.gif` and `<dataset id>-still.png`, 25.3 MB |
| Requires | `src/data/catalog-art.ts`, generated |
| Build | `DATASET_DIR=../exercises-dataset node scripts/build-catalog.mjs` |
| Seen on | `/movements` and `/movements/[id]` |

The filter keeps dumbbells, barbell, bodyweight and weighted work. It drops
machines, cables, pull-up and chin-up bars, rings, stability balls, BOSU, arm
blasters, suspension and duplicate names. 651 remain.

The list renders the first-frame PNG, not the GIF. Running 651 loops at once
turns a scroll into a slideshow; the detail page runs exactly one.

The still carries its own basename because Android flattens `res/drawable`
names and drops the extension: `1760.gif` and `1760.png` become the same
resource and the merger fails the build. The release APK is 61 MB, up from
33.6 MB, almost all of it this art.

`src/domain/catalog.ts` turns a record into the engine's `Movement`:

- equipment becomes loading; one dumbbell is one hand, weighted bodyweight stays
  bodyweight
- the name decides pattern, unit and rep range: carries and planks are held,
  push-ups start at 6, isolation work at 10, compounds at 8
- the first three dataset steps become the cues
- `needsRack` is an exact list of 20 barbell bench press and back squat variants.
  They are readable on the shelf but cannot take a slot, because the room has no
  rack.

The dataset's instruction text is still weaker than the hand-written cues, so it
is shown as numbered steps, not as coaching. The eleven program movements keep
their own cues.

A slot stores the dataset id of whatever replaced it (`state.slots`). The
original prescription is never overwritten, so putting the original back costs
nothing. Every screen resolves through `slotTarget` and `movementById`; reading
`SESSIONS[key].movementIds` directly would show the old name after a swap.

## The repositories that were rejected, and why

- `yuhonas/free-exercise-db` — 876 exercises, two stills each, Unlicense. Legal
  and covered all eleven, but stills, and the pixels are stock gym photography of
  unclear original provenance. This is the fallback if the loops ever have to go.
- `harshvishu/free-exercise-db-with-videos` — 593 1080p mp4s. Code MIT, but the
  README credits the videos only as "redistributed here with the maintainer's
  rights", which is a statement about the maintainer, not a grant to anyone else.
- `everkinetic/data` — 289 exercises, clean black line art, CC-BY-SA-4.0, genuinely
  open. Covers only five of the eleven, and mixing line art with renders would
  look like two apps.

Videos were rejected on size as well: Ledger blocks `INTERNET` at the manifest
level, so every frame is bundled. Eleven loops cost 1.6 MB. A 1080p video set
costs roughly two hundred times that, and a workout app that ships 200 MB is one
people uninstall.

## How the files were made

```sh
curl -sfL -o src.gif \
  https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/HEAD/videos/<id>-<slug>.gif

magick src.gif -coalesce -resize 450x450 -filter Lanczos \
  -colorspace Gray -level 5%,95% \
  +level-colors '#3A332B,#F6F2E9' \
  -colors 24 -dither None -strip -layers Optimize \
  assets/movements/<movement>.gif
```

`-coalesce` first, or the frames are deltas and the resize only sees the changed
rectangle. `-layers Optimize` last, or the file triples. Twelve frames at 100 ms,
with a one-second hold on the first frame, is the source's own timing and it is
kept as-is.
