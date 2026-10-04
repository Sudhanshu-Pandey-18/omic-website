# OMIC Cultural Hub — website (v3: "A Night at OMIC")

**Culture · Cinema · Cafe** — Warehouse 110, Goshi Warehouse City, Al Quoz, Dubai.

**Live:** https://sudhanshu-pandey-18.github.io/omic-website/

The site is an evening at OMIC. Its colours move from **dusk → twilight → night → ember → dawn → day**
as you scroll, and every section is a small artwork you can touch.

## Run it

```bash
npm install            # vite, three, gsap, lenis (+ @fontsource, already copied to public/fonts)
npm run fetch-assets   # posters, artist photos and cafe images from omic.spot (already done)
npm run dev            # http://localhost:5173
npm run build          # production build in /dist
```

## Deploy (GitHub Pages)

Every push to `main` builds the site and publishes it automatically
(`.github/workflows/deploy.yml`). Watch progress in the repo's **Actions** tab; it takes about a minute.
Settings → Pages → Source must stay on **GitHub Actions**.

- The site lives in a sub-folder (`/omic-website/`). The workflow sets `BASE_PATH=/omic-website/` for the build.
- Paths in HTML (`href="/..."`, `src="/..."`, `url(/...)`) are fixed automatically at build time by the
  small plugin in `vite.config.js`. Write them as normal root paths.
- Paths written **in JavaScript** (new images, new page links) must go through the helper:
  `import { url } from './data.js'` → `url('/assets/new.jpg')`.
- Moving to a custom domain or Cloudflare Pages? Build without `BASE_PATH` (just `npm run build`)
  and the site works from the root.
- Test the sub-folder build locally: `BASE_PATH=/omic-website/ npm run build && npx vite preview --base /omic-website/`.

## New in v3

- **One persistent world.** A single WebGL layer (`src/js/world/`) lives above every page. The four
  O·M·I·C drops are glossy 3D ink that lift off the painted hero logo, perch on the manifesto's key
  words, dive into the warehouse, pour into the latte (each one splashes the foam), land on the
  Shared Ground painting, orbit the founder and pile up in the footer where you can throw them.
  Between sections they rest as a 4-dot scroll indicator in the corner.
- **Seamless navigation** (`src/js/router.js`): pages swap under the ink curtain without reloading,
  so the world, sound and cursor never restart. Links prefetch on hover.
- **Living images**: portraits and posters are redrawn in WebGL — they dissolve in like ink, ripple
  and split colour under the cursor, and bend with scroll speed.
- **Cinematic corridor**: bloom on the spotlights and neon, film grain, vignette, chromatic aberration.
- **Kinetic type**: the hero headline's letters lean away from the cursor.
- **Original generative score + UI foley** (all synthesised; off until the visitor opts in).
- **Real loading**: the film countdown holds on "1" until fonts and first images are ready.
- **404 page** that matches the site.

## What's on the home page

| # | Section | Hour | What happens |
|---|---|---|---|
| 0 | **Film-leader intro** | — | A projectionist's 3·2·1 countdown with the OMIC circles as registration marks, gate flicker, scratches. "Enter with sound" starts a synthesised projector-room ambience. Shown once per visit. |
| 1 | **Living ink** | dusk | A real GPU fluid simulation painted as watercolour on paper. Move to paint, click to drop colour. The OMIC logo is the ink's *memory*: stop touching it and it heals back. |
| 2 | **Manifesto** | twilight | Words fly in from everywhere and settle into the sentence; a curator's pencil circles *cinema*, boxes *theatre*, underlines *art*. |
| 3 | **The warehouse (3D)** | night | Three.js walk through a dark gallery corridor: every event poster under its own spotlight with dust in the beams, wall lettering, a neon OMIC sign at the end. Hover lifts a frame, click enters. |
| 4 | **Bring a torch** | night | Three rooms (Culture, Cinema, Cafe) in the dark; your cursor is the torch that reveals what's inside. |
| 5 | **Cinema** | night | Letterbox bars close in, projector beam, flickering screen with gate weave, rolling credits, a sweeping film-leader date, and a 50-seat theatre that fills up — house full. |
| 6 | **Intermission** | ember | A latte you can stir (same fluid engine, in a cup); the heart heals. Menu rail. |
| 7 | **Shared Ground** | dawn | A generative painting for the Art Prize: hundreds of strokes from everywhere settle into one ground as you scroll. Click to paint a new one. Flip-clock countdown, AED 15,000, brush-revealed jury. |
| 8 | **Founder** | day | Brush-stroke portrait reveal, hand-drawn annotations. |
| 9 | **Visit + footer** | night | Map, live time in Al Quoz, and the footer's physics circles you can drop and throw. |

Everywhere: Lenis smooth scrolling, GSAP split-text reveals, a brush cursor that leaves a fading trail
in the colour of the current hour, and **ink-bleed page transitions**.

## Code map

```
src/js/lib/fluid.js         GPU fluid + watercolour renderer with "memory" (hero, latte)
src/js/lib/corridor.js      Three.js warehouse corridor
src/js/lib/leader.js        film-leader intro
src/js/lib/shared-ground.js generative strata painting
src/js/lib/transition.js    ink-bleed page transitions
src/js/lib/cursor.js        brush cursor + trail
src/js/lib/sound.js         synthesised ambience (no audio files)
src/js/ink.js               metaball physics circles (footer, and fallback for the hero)
src/js/app.js               single entry for every page
src/js/router.js            seamless page changes
src/js/world/world.js       persistent WebGL world: drops + living images
src/js/world/layouts.js     where the drops go in each section
src/js/core.js              Lenis + GSAP setup, page lifecycle, hours, reveals, header/footer, forms
src/js/home.js / page.js    page scenes
src/js/data.js              events and menu — edit to update the programme; url() path helper
vite.config.js              pages list + base-path fixer for GitHub Pages
.github/workflows/deploy.yml  build + publish to GitHub Pages on every push to main
src/css/style.css           design system (v2 hours at the bottom)
public/fonts/               Oswald, Outfit, Instrument Serif (self-hosted)
```

## Fallbacks & accessibility

- No WebGL2 → the hero uses the lighter metaball circles; no WebGL → the corridor becomes a poster grid.
- `prefers-reduced-motion` → no smooth scroll, no intro, no scroll animations.
- Real text for every event name and date; schema.org `Event` data on event pages.
- Canvases pause when off-screen or when the tab is hidden.

## Forms

Demo mode (validate + thank-you, nothing sent). Set `FORM_ENDPOINT` in `src/js/core.js` to OMIC's
Google Apps Script URL to go live.

## Still needed from OMIC

Opening hours, contact email/phone, Instagram handle, cafe prices, photos of the theatre and gallery,
and confirmation of the combo names/times and of the "Afterimage" exhibition naming.
