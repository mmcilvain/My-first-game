# Blackout Protocol — Current Project Status

_Last updated: 2026-08-02_

## Purpose

Blackout Protocol is a procedural Three.js first-person shooter demo with an original near-future military atmosphere. It runs entirely in the browser with no backend, database, API key, paid service, external model, image, video, or audio asset dependency.

## Source of truth

- GitHub repository: https://github.com/mmcilvain/My-first-game
- Owner/repository: `mmcilvain/My-first-game`
- Production branch: `main`
- GitHub is the source of truth for future edits.
- Do not maintain a separate manually copied version of the project.

## Vercel deployment

- Vercel project: `blackout-protocol`
- Project ID: `prj_b3h7I8yEQfHepTTIcpsWZJ2WyCPA`
- Team ID: `team_qGZSkrnXuUyAI0AhAAeMBOax`
- Stable production URL: https://blackout-protocol-beryl.vercel.app
- GitHub integration is configured so `main` is intended to deploy to production automatically.
- Vercel settings:
  - Framework preset: Vite
  - Install command: `npm install`
  - Build command: `npm run build`
  - Output directory: `dist`
- Last verified production deployment at the time of this note: `dpl_6o6MgkZ6kZurXUbaNNJjWTd1CTj1`
- The stable production URL returned HTTP 200 and served the Blackout Protocol build.
- If automatic deployment ever appears broken, check Vercel project **Settings → Git** and confirm the repository is `mmcilvain/My-first-game` and the production branch is `main`.

## Local development

From the project root:

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

The production output is written to `dist/`.

## Project structure

- `index.html` — HTML shell and HUD structure
- `src/main.js` — application bootstrap and game loop
- `src/styles.css` — responsive HUD, menus, loading screen, and mobile controls
- `src/game/` — player, mobile input, weapons, physics, particles, and post-processing
- `src/world/` — procedural textures, materials, props, and world construction
- `README.md` — project documentation
- `vercel.json` — static Vite deployment configuration
- `vite.config.js` — production chunk-splitting configuration

## Current game state

The current build includes:

- Original compact multi-level relay-yard combat environment
- Indoor and outdoor spaces, stairs, ramps, balconies, cover, pillars, pipes, cables, crates, barriers, barrels, racks, targets, foliage, puddles, haze, signage, and industrial lighting
- Procedural canvas textures and generated materials for concrete, metal, glass, paint, wet surfaces, wood, fabric, and warning markings
- Dusk lighting, skyline silhouettes, emissive signage, localized lights, muzzle flashes, bloom, vignette, film grain, contrast grading, and contact shading
- Procedural Vanta-9 tactical carbine viewmodel with receiver, barrel, magazine, grip, stock, sights, gloves, recoil, sway, ADS, muzzle flash, shell ejection, tracers, reloads, ammo, and dry-fire feedback
- Moving targets, head/body hit zones, headshots, scoring, rounds, combos, hit markers, target resets, and field-clear feedback
- Phase 1 Operation Nightfall mission: three relay terminals, extraction zone, hostile security-unit pressure, player damage/death, blackout state, mission success/failure/restart
- Phase 2 performance/combat-readability pass: Three.js vendor chunk splitting, lower enemy allocation churn, live objective distance, and blackout countdown feedback
- Desktop controls: WASD, mouse look, pointer lock, left-click fire, right-click ADS, Shift sprint, Space jump, C/Ctrl crouch, R reload, E interact, Esc pause
- Mobile controls: virtual joystick, drag look region, fire, ADS, jump, crouch, sprint, reload, fullscreen support, safe-area padding, and orientation messaging
- Graphics presets: Low, Medium, High
- Runtime settings for resolution scale, shadows, bloom, contact shading, particles, dynamic lights, anti-aliasing, foliage density, sensitivity, invert look, audio volume, mute, and FPS counter
- Synthesized Web Audio effects for gunfire, reload, impacts, UI feedback, and footsteps
- Pooled particles, impacts, decals, shell casings, and lightweight physics objects
- Reset-player safeguard when the player leaves the playable volume

## Future editing workflow

1. Make code changes in GitHub on `main`, or create a branch and merge through GitHub.
2. Let Vercel build and deploy from GitHub.
3. Verify the production URL after deployment.
4. Keep the game playable when advanced effects are disabled.
5. Preserve procedural generation and avoid adding undeclared remote assets.
6. Run `npm run build` before considering a change complete.

## Useful handoff instruction for a future ChatGPT chat

Continue improving the existing Blackout Protocol project in GitHub repository `mmcilvain/My-first-game`. GitHub `main` is the source of truth and Vercel deploys the production build. Preserve the current controls, procedural-only asset approach, Vite structure, mobile support, and existing gameplay while making targeted graphics, performance, UI, and gameplay improvements. Verify with `npm run build` and the production URL after changes.
