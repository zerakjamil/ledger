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
| Attribution | the foot of the form page, and the bottom of Settings |

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

**If this app ever leaves that phone, these eleven files must be replaced first.**
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

## Why the 1,324-movement catalog stays out

The same repository is MIT for the code, the record structure and the
instruction text; the media is carved out as above. The text is the only part
that could be taken without a licence, and it is weaker than what the form page
already says. Its front squat, for example, instructs "pushing your hips back"
and "making sure your knees do not go past your toes": the first is a back
squat hinge, and the second is a warning a front squat cannot obey. The three
cues here say "sit down between the feet" and "knees track over the toes",
which is the movement.

Breadth is the other reason. The app's mechanism is three movements a day,
repeated for weeks; 1,324 choices with a search field would turn one decision
into a browse. The dataset is a quarry for a later block, not a runtime
dependency. `index.html` in the same repository is a good offline way to pick
from it when that block is designed.

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
