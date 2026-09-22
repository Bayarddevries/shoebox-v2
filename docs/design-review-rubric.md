# Attract Screen Review Rubric

The museum-quality bar for the Métis Kin pedestal tablet attract screen (1280x800 landscape).
Every critic pass scores the SAME eight criteria, 1-10, and must cite what it saw.

## Non-negotiable constraints (a violation fails the concept outright)

- **Never crop a photo.** Every print keeps its original aspect ratio (`background-size:contain`).
  Cropping destroys archival integrity and is an instant rejection.
- **Offline-safe.** The kiosk must paint on a network with no internet. Fonts load non-blocking.
- **GPU-cheap.** Only transform/opacity animations, on one or two elements maximum. It runs on a
  modest tablet, so no per-print animation loops, no heavy filters on many elements.

## Scope rule: do NOT evaluate the photographs

The images are REAL archival scans from a community photograph archive. Judge the DESIGN only:
the composition, mounting, grid, typography, palette, hierarchy, motion. Do not comment on the
content, quality, authenticity or "AI-ness" of the photographs themselves, and never claim the
photographs are AI-generated. At thumbnail size a vision pass will invent flaws that are not
there ("melted faces", "malformed hands"). That is a known failure mode, not a finding.

## The eight criteria

| # | Criterion | What a 10 looks like |
|---|-----------|----------------------|
| 1 | **Hierarchy / focal point** | The eye lands somewhere deliberate in the first second. One dominant element; supporting material recedes. No competing anchors. |
| 2 | **Scale / legibility** | Photographs are big enough to read as photographs, not texture. Faces and content are discernible at a glance from several feet. |
| 3 | **Density balance** | Even, intentional visual weight. No accidental holes, no overcrowded patches. Negative space looks composed. |
| 4 | **Archival integrity** | Nothing cropped or distorted. Original prints, borders and mats respected. White/cream scan borders read as part of the object. |
| 5 | **Palette coherence** | One warm archival world. No jarring modern colour snapshot intruding on sepia. Background supports the prints. |
| 6 | **Typography** | Wordmark and cue are clearly legible at viewing distance, well spaced, confident. The cue reads as an invitation, not fine print. |
| 7 | **Motion** | Subtle, slow, purposeful. It should feel alive, not animated. A still screenshot must still imply calm movement. |
| 8 | **Hook power** | The honest test: would a stranger crossing the room walk over and touch it? |

## Verdict bands

- **>= 8 average with no score below 7** → ship candidate.
- **6-7.9 average** → refine: fix the ranked list and re-review.
- **< 6 average, or any constraint violation** → rethink the concept.

## Critic output format

Return JSON only:

```
{
  "concept": "A|B|C|D",
  "avg": 6.4,
  "scores": {"hierarchy": 5, "scale": 4, ...},
  "constraint_violations": ["..."],
  "strongest_thing": "...",
  "top_fixes": [
    {"issue": "...", "why_it_matters": "...", "concrete_fix": "specific CSS/JS instruction", "impact": "high|medium|low"}
  ],
  "keep": ["things that already work and must not be broken"],
  "verdict": "ship candidate | refine | rethink"
}
```

The critic must be adversarial: hunt for what is wrong, name it precisely, and give fixes an
engineer can apply without guessing. Praise is only useful when it says what NOT to break.
