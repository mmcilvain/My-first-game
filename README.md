# Blackout Protocol

Blackout Protocol is a self-contained, procedural first-person shooter demo for modern desktop and mobile browsers. It uses Three.js and Vite, with no backend, API key, remote model, image texture, sound file, or paid service.

The playable field is an original compact industrial relay yard with an indoor service corridor, upper catwalk, stairs, ramps, target dummies, cover, props, procedural foliage, flickering lights, material-aware impacts, synthesized audio, and responsive touch controls. All visual assets are generated at runtime from primitive geometry, generated canvas textures, and pooled effects.

## Local setup

Requirements: Node.js 18 or newer and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. For a production build:

```bash
npm run build
npm run preview
```

The production output is written to `dist/` and is a static Vite build.

## Desktop controls

| Action | Control |
| --- | --- |
| Move | W / A / S / D |
| Look | Mouse after pointer lock |
| Fire | Left mouse button |
| Aim down sights | Right mouse button |
| Sprint | Shift |
| Jump | Space |
| Crouch | Ctrl or C |
| Reload | R |
| Pause / resume | Escape |

Click the game canvas after starting if the browser has released pointer lock. If pointer lock is rejected, the pause menu still provides touch/mouse-accessible settings and reset controls.

## Mobile controls

- Left thumb: virtual joystick for movement.
- Right half: drag to look.
- Fire, aim, sprint, crouch, jump, and reload buttons are placed within thumb reach.
- Touch input uses Pointer Events and supports simultaneous movement/look/action touches.
- A landscape recommendation appears on small portrait screens, but portrait play remains available.
- Use the Full Screen control from the pause menu where the browser supports it.

The browser must receive a user gesture before synthesized audio can begin. iOS Safari and some embedded browsers can limit full screen, audio resume, device-motion APIs, or GPU resolution; the game remains playable without those optional features.

## GitHub usage

Create a repository, copy the project files into its root, then commit and push:

```bash
git init
git add .
git commit -m "Create Blackout Protocol web game"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git push -u origin main
```

The repository intentionally contains no generated asset directory. Keep the `src/game` and `src/world` systems separate when making edits so the controller, weapon, effects, and level can evolve independently.

## Vercel deployment

### Vercel dashboard

1. Push the project to GitHub.
2. In Vercel, choose **Add New → Project**.
3. Import the GitHub repository.
4. Confirm these settings:

   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

5. Deploy. No environment variables are required.

### Vercel CLI

Install or use the CLI through npx, authenticate, and run from the project root:

```bash
npx vercel login
npx vercel
npx vercel --prod
```

When prompted, use the existing project or create a new one. The included `vercel.json` already declares the Vite build and `dist` output.

## Graphics and performance

The game detects coarse pointer input, approximate device memory, and logical CPU count. Mobile devices default to Low or Medium. The pause menu exposes Low, Medium, and High presets plus individual controls for resolution scale, shadows, bloom, contact shading, particle density, dynamic lights, foliage, anti-aliasing, look sensitivity, invert look, volume, and an FPS counter.

The renderer caps device pixel ratio on mobile. Repeated crates use instanced rendering. Particles and bullet marks use fixed pools. Physics uses a bounded fixed-step accumulator and a small number of active dynamic bodies. The scene uses frustum culling, distance-limited lights, simple collision boxes, and a custom inexpensive post-processing pass. Anti-aliasing is selected when the renderer is created, so changing that setting displays a restart notice; the other graphics settings apply immediately.

For the smoothest mobile session, begin with Low, keep the browser tab visible, and use landscape orientation. High is intended for desktop GPUs.

## Procedural asset notes

`src/world/ProceduralTextures.js` creates cached canvas textures for concrete, metal, tile, painted equipment, glass, wet surfaces, wood, fabric, and rubber. `Materials.js` maps those generated textures to Three.js materials. `Props.js` builds original crates, barrels, barriers, racks, dummies, planters, pipes, cables, and frames. No remote asset URL is required.

## Troubleshooting

**Blank or fault screen:** Use a current browser with WebGL and hardware acceleration enabled. Reload after closing other GPU-heavy tabs.

**Low frame rate:** Open Pause → Settings, choose Low, lower resolution scale, disable bloom/contact shading, reduce dynamic lights, and reduce particle density.

**No sound:** Tap/click the game first, confirm the tab is not muted, and use the pause menu volume control. The game remains playable when Web Audio is unavailable.

**Pointer lock rejected:** Click the canvas after starting, or use a browser that allows pointer lock for the current origin. Touch gameplay never depends on pointer lock.

**Full screen rejected:** Full screen must be requested from a user gesture and can be blocked by iOS Safari, an embedded web view, or browser policy. Use the browser’s own full-screen option if needed.

**Player stuck or outside the level:** Open Pause → Reset Player. The controller also automatically resets when the player falls outside the safe play volume.

**Orientation changed but the view looks wrong:** Rotate the device again or reload once. The renderer listens for both resize and orientation-change events and recalculates its camera and render target.

## File map

```text
index.html
package.json
vercel.json
README.md
src/
  main.js
  styles.css
  game/
    PlayerController.js
    MobileControls.js
    WeaponSystem.js
    PhysicsSystem.js
    ParticleSystem.js
    PostProcessing.js
  world/
    WorldBuilder.js
    ProceduralTextures.js
    Materials.js
    Props.js
```

## Verification checklist

- [ ] `npm install`
- [ ] `npm run dev`
- [ ] `npm run build`
- [ ] Import the GitHub repository into Vercel with the Vite settings above
- [ ] Start the game and test desktop movement, mouse look, shooting, aiming, sprint, jump, crouch, and reload
- [ ] Test mobile joystick, drag look, fire, aim, jump, crouch, sprint, reload, and multiple touches
- [ ] Rotate between portrait and landscape
- [ ] Switch Low, Medium, and High presets and confirm the FPS counter/settings respond
