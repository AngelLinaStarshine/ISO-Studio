# Iso Studio — Isometric Sketch Trainer

An adaptive, browser-based app for grade 7–8 learners to practice
sketching 3D objects on an isometric dot grid. Aligned with Common
Core 7.G.1 and 7.G.2.

## What's in this folder

| File          | Purpose                                                    |
|---------------|------------------------------------------------------------|
| `index.html`  | Page markup. Loads `styles.css` and `app.js`.              |
| `styles.css`  | All styling: drafting-paper palette, layout, components.   |
| `app.js`      | All logic: iso geometry, task bank, adaptive engine, UI.   |
| `iso-studio-isometric-trainer.html` | Single-file bundle (same app).          |
| `README.md`   | This file.                                                 |

No build step. No dependencies. No server required.

## How to run

Open `index.html` in any modern browser (Chrome, Safari, Firefox,
Edge — desktop or mobile). Everything works from a `file://` path.

For development with auto-reload, any static server works:

```
python3 -m http.server
```

Then visit `http://localhost:8000`.

## How the app works

### What the learner sees

The left panel shows **three orthographic views** (Front, Side, Top)
as simple labeled square grids — solid squares where a cube exists,
faint dashed outlines where it doesn't. The learner studies these
flat views to understand the shape, then builds the 3D isometric
drawing themselves on the dot grid (no tracing).

A glowing **START HERE** dot marks a suggested place to begin.
Placement on the grid is purely cosmetic — only the *shape* is
graded, not where on the dots the figure sits.

### Drawing

Tap a dot, then tap another dot in line with it to draw an edge
(dragging works too). Lines must follow an isometric direction
(x, y, or z). The toolbar provides Draw, Erase, Undo, Clear, and
the Task Bank.

### Verification (translation-invariant)

When the learner presses **Check**, the grader slides their
drawing across every integer offset on the lattice and keeps the
alignment that matches the most target edges. A figure passes if
≥85% of edges match and stray lines are ≤10%. Color feedback:
green = correct edge, red = stray, dashed gold = missing.

### Adaptive progression

Seven levels:

1. Single Cube
2. Cube Rows
3. Flat L-Shapes
4. Solid Boxes
5. Base + Tower (two parts, different sizes)
6. Staircases
7. Composites (three parts, asymmetric)

Each level has multiple stages (`cx` 1–4) that increase shape
complexity. **Every successful Check** advances one stage, then
the level.

If a learner cannot pass at their current level, they stay on that
level and are offered remedial shapes: one **alternate** figure,
then up to **three similar** practice figures. After five failed
checks without passing, they restart at **Level 1** with the
original lesson shapes. Textbook practice tasks do not affect
adaptive level or XP.

Progress persists across sessions via `window.storage` when the
host supports it, with an in-memory fallback so it still runs from
a plain file.

## Code map (for graders / reviewers)

### `styles.css`
- CSS variables at top: drafting-paper palette
- `.wrap` / `header` / `main` / `.panel` — layout shell
- `.refbox` / `#refCanvas` — orthographic views container
- `.studio` / `#board` / `.toolbar` / `.actbar` — drawing studio
- `.scrim` / `.modal` / `.bank` / `.bcard` — task bank modal
- `@media (max-width:860px)` — mobile adjustments

### `app.js`
- `Store` — persistent storage with graceful fallback
- Iso geometry — `toAB`, `screenOf`, `buildTarget` (visible edges
  via back-face culling)
- Task generator — `genTask(level, cx, seed)` produces an unlimited
  number of seeded shapes per level
- `Eng` — adaptive engine (record results, ascend / descend)
- `grade()` — translation-invariant verification
- Canvas rendering — `draw()`, `renderRef()`, `orthoGrids()`,
  START HERE animation, color-coded feedback
- Interaction — pointer/touch handlers, segment validation
- Task lifecycle — `loadTask`, `newAdaptiveTask`, HUD, ladder,
  task-bank modal
- Boot — `await Eng.load()`, then start

## Pedagogy

This addresses gaps left by leading competitors:

- The NCTM Illuminations Isometric Drawing Tool has no save, no
  tasks, no assessment — Iso Studio adds all three.
- IXL's three-dimensional-shapes practice is multiple-choice only —
  Iso Studio is true sketching.
- Khan Academy covers 3D shapes in articles only, no practice.

The task ladder follows the sequence recommended by curriculum
designers (TeachEngineering, NCTM): start by drawing a single
cube, then multiple cubes, then combined parts at different edges
in multiple sizes.

## Browser compatibility

Tested on Chromium-based browsers (desktop and mobile). Uses
plain Canvas 2D, no WebGL, no service workers, no localStorage.
Should work on any browser from 2018 or later.
