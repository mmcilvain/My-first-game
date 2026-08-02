import * as THREE from 'three';
import './styles.css';
import { EnemySystem } from './game/EnemySystem.js';
import { MissionSystem } from './game/MissionSystem.js';
import { MobileControls } from './game/MobileControls.js';
import { ParticleSystem } from './game/ParticleSystem.js';
import { PhysicsSystem } from './game/PhysicsSystem.js';
import { PlayerController } from './game/PlayerController.js';
import { PostProcessing } from './game/PostProcessing.js';
import { WeaponSystem } from './game/WeaponSystem.js';
import { createMaterialLibrary } from './world/Materials.js';
import { WorldBuilder } from './world/WorldBuilder.js';

const $ = (selector) => document.querySelector(selector);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function detectDevice() {
  const mobile = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const memory = navigator.deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  const lowPower = mobile && (memory <= 3 || cores <= 4);
  return { mobile, lowPower, memory, cores };
}

const presets = {
  low: { resolutionScale: .62, shadowQuality: 0, bloom: false, ao: false, grain: false, particleDensity: .3, dynamicLights: 2, foliageDensity: .45, antialias: false },
  medium: { resolutionScale: .82, shadowQuality: 1, bloom: true, ao: true, grain: true, particleDensity: .62, dynamicLights: 4, foliageDensity: .72, antialias: true },
  high: { resolutionScale: 1, shadowQuality: 2, bloom: true, ao: true, grain: true, particleDensity: 1, dynamicLights: 6, foliageDensity: 1, antialias: true },
};

class SoundEngine {
  constructor() {
    this.context = null;
    this.master = .7;
    this.effects = .8;
    this.muted = false;
    this.noiseBuffer = null;
  }

  ensure() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      this.context = new AudioContext();
      this.noiseBuffer = this.context.createBuffer(1, this.context.sampleRate * .5, this.context.sampleRate);
      const channel = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < channel.length; i += 1) channel[i] = Math.random() * 2 - 1;
    }
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    return true;
  }

  outputGain() {
    if (!this.context || this.muted) return null;
    const gain = this.context.createGain();
    gain.gain.value = this.master * this.effects;
    gain.connect(this.context.destination);
    return gain;
  }

  tone(frequency, duration, type = 'sine', volume = .08, slide = 0) {
    const output = this.outputGain();
    if (!output) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.linearRampToValueAtTime(Math.max(30, frequency + slide), now + duration);
    envelope.gain.setValueAtTime(.001, now);
    envelope.gain.exponentialRampToValueAtTime(volume, now + .008);
    envelope.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(envelope).connect(output);
    oscillator.start(now);
    oscillator.stop(now + duration + .02);
  }

  noise(duration = .12, volume = .1, filterFrequency = 1800) {
    const output = this.outputGain();
    if (!output || !this.noiseBuffer) return;
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = 'bandpass'; filter.frequency.value = filterFrequency; filter.Q.value = .7;
    envelope.gain.setValueAtTime(volume, now);
    envelope.gain.exponentialRampToValueAtTime(.001, now + duration);
    source.connect(filter).connect(envelope).connect(output);
    source.start(now); source.stop(now + duration + .02);
  }

  shot() { this.tone(112, .09, 'sawtooth', .13, -70); this.noise(.08, .17, 1900); }
  enemyShot() { this.tone(82, .12, 'square', .07, -36); this.noise(.08, .08, 1250); }
  dry() { this.tone(145, .07, 'square', .08, -50); }
  reload() { this.tone(220, .06, 'square', .07, -50); window.setTimeout(() => this.tone(420, .08, 'square', .06, 80), 480); }
  reloadDone() { this.tone(580, .08, 'triangle', .07, -130); }
  impact(kind) { if (kind === 'metal') this.tone(720, .11, 'triangle', .07, -300); else if (kind === 'glass') this.noise(.09, .08, 4200); else this.noise(.07, .055, 620); }
  step() { this.noise(.055, .035, 340); }
  ui() { this.tone(520, .05, 'sine', .035, 80); }
  setVolume(value) { this.master = value; }
  setMuted(value) { this.muted = value; }
}

class GameApp {
  constructor() {
    this.device = detectDevice();
    const defaultPreset = this.device.lowPower ? 'low' : this.device.mobile ? 'medium' : 'high';
    this.settings = { preset: defaultPreset, ...presets[defaultPreset], sensitivity: 1, mobileSensitivity: .62, invertY: false, volume: .7, fps: false };
    this.loadSettings();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1a21);
    this.scene.fog = new THREE.FogExp2(0x193637, .0115);
    this.camera = new THREE.PerspectiveCamera(76, 1, .04, 130);
    this.clock = new THREE.Clock();
    this.lastFrame = 0;
    this.elapsed = 0;
    this.playing = false;
    this.started = false;
    this.hiddenBeforeVisibility = false;
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.round = 1;
    this.roundResetTimer = 0;
    this.hitMarkerTimer = 0;
    this.input = { keys: new Set(), movement: new THREE.Vector2(), mobileMovement: new THREE.Vector2(), lookX: 0, lookY: 0, fire: false, aim: false, sprint: false, crouch: false, mobileCrouch: false, jumpPressed: false, reloadPressed: false, interactPressed: false, isMobile: this.device.mobile };
    this.idleInput = { ...this.input, movement: new THREE.Vector2(), lookX: 0, lookY: 0, jumpPressed: false, reloadPressed: false, interactPressed: false, fire: false, aim: false, sprint: false, crouch: false };
    this.sound = new SoundEngine();
    this.dom = {
      canvas: $('#gameCanvas'),
      loading: $('#loadingScreen'),
      loadingStage: $('#loadingStage'),
      loadingBar: $('#loadingBar'),
      start: $('#startScreen'),
      hud: $('#hud'),
      mobile: $('#mobileControls'),
      pause: $('#pauseMenu'),
      missionResult: $('#missionResult'),
      damageFlash: $('#damageFlash'),
      error: $('#errorScreen'),
      errorMessage: $('#errorMessage'),
    };
    this.bindBasicControls();
  }

  loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem('blackout-protocol-settings') ?? 'null');
      if (saved) this.settings = { ...this.settings, ...saved };
    } catch { /* Device storage can be unavailable in private browsing. */ }
  }

  saveSettings() {
    try { localStorage.setItem('blackout-protocol-settings', JSON.stringify(this.settings)); } catch { /* Optional persistence. */ }
  }

  async init() {
    try {
      await this.stage('Initializing renderer', 12);
      this.createRenderer();
      await this.stage('Generating textures', 28);
      this.materials = createMaterialLibrary(this.renderer);
      await this.stage('Building world', 48);
      this.world = new WorldBuilder(this.scene, this.materials, this.settings).build();
      this.world.setGraphics(this.settings);
      await this.stage('Creating physics', 63);
      this.physics = new PhysicsSystem(this.world.collisionBoxes);
      this.player = new PlayerController(this.camera, this.physics, this.world.spawn, {
        sensitivity: this.settings.sensitivity,
        mobileSensitivity: this.settings.mobileSensitivity,
        invertY: this.settings.invertY,
        onStep: (kind) => this.sound.step(kind),
        onDamage: (amount, source) => this.onPlayerDamage(amount, source),
        onDeath: () => this.failMission(),
      });
      this.player.reset();
      this.world.dynamicObjects.forEach((object) => this.physics.addBody(object, object.userData));
      await this.stage('Preparing effects', 78);
      this.particles = new ParticleSystem(this.scene, this.settings);
      this.post = new PostProcessing(this.renderer, this.settings);
      this.post.setSettings(this.settings);
      this.enemySystem = new EnemySystem(this.world, this.physics, this.particles, this.sound, {
        onAttack: ({ amount }) => this.showToast('CONTACT // -' + amount + ' VITALS'),
      });
      this.mission = new MissionSystem(this.world, this.player, this.enemySystem, {
        onToast: (message) => this.showToast(message),
        onState: () => this.updateMissionHud(),
        onPrompt: (message) => this.setInteractionPrompt(message),
        onComplete: () => this.endMission(true),
        onFail: () => this.endMission(false),
      });
      this.weapon = new WeaponSystem(this.camera, this.world, this.physics, this.particles, this.sound, {
        onTargetHit: (target, details) => {
          this.enemySystem.onHit(target, details);
          this.onTargetHit(target, details);
        },
      });
      this.mobileControls = new MobileControls(this.dom.mobile, { onMove: (x, y) => this.setMobileMove(x, y), onLook: (x, y) => this.addLook(x, y), onAction: (action, active) => this.handleMobileAction(action, active) });
      this.bindUI();
      this.resize();
      window.addEventListener('resize', () => this.resize(), { passive: true });
      window.addEventListener('orientationchange', () => window.setTimeout(() => this.resize(), 120), { passive: true });
      document.addEventListener('visibilitychange', () => this.handleVisibility());
      await this.stage('Ready', 100);
      this.dom.loading.classList.add('hidden');
      this.dom.start.classList.remove('hidden');
      this.updateSettingsUI();
      this.renderer.setAnimationLoop((time) => this.frame(time));
    } catch (error) {
      this.showError(error);
    }
  }

  stage(label, progress) {
    this.dom.loadingStage.textContent = label;
    this.dom.loadingBar.style.width = `${progress}%`;
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  createRenderer() {
    if (!this.dom.canvas.getContext('webgl2') && !this.dom.canvas.getContext('webgl')) throw new Error('WebGL is unavailable. Try a current version of Safari, Chrome, Edge, or Firefox with hardware acceleration enabled.');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.dom.canvas, antialias: this.settings.antialias, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = this.settings.shadowQuality > 0;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x0b1a21, 1);
  }

  bindBasicControls() {
    this.dom.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    this.dom.canvas.addEventListener('mousedown', (event) => {
      if (!this.started) return;
      if (event.button === 0) this.input.fire = true;
      if (event.button === 2) this.input.aim = true;
    });
    window.addEventListener('mouseup', (event) => { if (event.button === 0) this.input.fire = false; if (event.button === 2) this.input.aim = false; });
    window.addEventListener('mousemove', (event) => { if (document.pointerLockElement === this.dom.canvas && this.playing) this.addLook(event.movementX, event.movementY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => { if (this.started && !this.device.mobile && document.pointerLockElement !== this.dom.canvas && this.playing) this.pause(); });
    window.addEventListener('keydown', (event) => {
      this.input.keys.add(event.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      if (event.code === 'Space' && !event.repeat) this.input.jumpPressed = true;
      if (event.code === 'KeyR' && !event.repeat) this.input.reloadPressed = true;
      if (event.code === 'KeyE' && !event.repeat) this.input.interactPressed = true;
      if (event.code === 'Escape' && this.started) { if (this.playing) this.pause(); else if (!this.dom.pause.classList.contains('hidden')) this.resume(); }
    });
    window.addEventListener('keyup', (event) => this.input.keys.delete(event.code));
    this.dom.canvas.addEventListener('click', () => { if (this.started && !this.device.mobile && document.pointerLockElement !== this.dom.canvas) this.dom.canvas.requestPointerLock?.().catch?.(() => {}); });
  }

  bindUI() {
    $('#playButton').addEventListener('click', () => this.start());
    $('#missionResultButton').addEventListener('click', () => this.restartMission());
    $('#resumeButton').addEventListener('click', () => this.resume());
    $('#resetButton').addEventListener('click', () => this.restartMission());
    $('#fullscreenButton').addEventListener('click', () => this.fullscreen());
    $('#muteButton').addEventListener('click', (event) => { this.sound.setMuted(!this.sound.muted); event.currentTarget.textContent = this.sound.muted ? 'UNMUTE AUDIO' : 'MUTE AUDIO'; });
    $('#retryButton').addEventListener('click', () => window.location.reload());
    document.querySelectorAll('.menu-tab').forEach((button) => button.addEventListener('click', () => this.switchTab(button.dataset.tab)));
    document.querySelectorAll('[data-preset]').forEach((button) => button.addEventListener('click', () => this.applyPreset(button.dataset.preset)));
    $('#resolutionScale').addEventListener('input', (event) => { this.settings.resolutionScale = Number(event.target.value) / 100; this.applySettings(); });
    $('#particleDensity').addEventListener('input', (event) => { this.settings.particleDensity = Number(event.target.value) / 100; this.applySettings(); });
    $('#dynamicLights').addEventListener('input', (event) => { this.settings.dynamicLights = Number(event.target.value); this.applySettings(); });
    $('#sensitivity').addEventListener('input', (event) => { this.settings.sensitivity = Number(event.target.value); this.player.setSensitivity(this.settings.sensitivity); this.updateSettingsUI(); this.saveSettings(); });
    $('#volume').addEventListener('input', (event) => { this.settings.volume = Number(event.target.value) / 100; this.sound.setVolume(this.settings.volume); this.updateSettingsUI(); this.saveSettings(); });
    $('#shadowQuality').addEventListener('change', (event) => { this.settings.shadowQuality = Number(event.target.value); this.applySettings(); });
    $('#bloomToggle').addEventListener('change', (event) => { this.settings.bloom = event.target.checked; this.applySettings(); });
    $('#aoToggle').addEventListener('change', (event) => { this.settings.ao = event.target.checked; this.applySettings(); });
    $('#grainToggle').addEventListener('change', (event) => { this.settings.grain = event.target.checked; this.applySettings(); });
    $('#aaToggle').addEventListener('change', (event) => { this.settings.antialias = event.target.checked; this.applySettings(); this.showToast('ANTI-ALIASING APPLIES ON NEXT LOAD'); });
    $('#fpsToggle').addEventListener('change', (event) => { this.settings.fps = event.target.checked; this.updateSettingsUI(); this.saveSettings(); });
    $('#invertToggle').addEventListener('change', (event) => { this.settings.invertY = event.target.checked; this.player.setInvertLook(this.settings.invertY); this.saveSettings(); });
  }

  setMobileMove(x, y) { this.input.mobileMovement.set(x, y); }
  addLook(x, y) { this.input.lookX += x; this.input.lookY += y; }

  handleMobileAction(action, active) {
    if (action === 'fire') this.input.fire = active;
    if (action === 'aim') this.input.aim = active;
    if (action === 'sprint') this.input.sprint = active;
    if (action === 'jump' && active) this.input.jumpPressed = true;
    if (action === 'reload' && active) this.input.reloadPressed = true;
    if (action === 'interact' && active) this.input.interactPressed = true;
    if (action === 'crouchToggle' && active) this.input.mobileCrouch = !this.input.mobileCrouch;
  }

  syncInput() {
    if (!this.device.mobile) {
      const keys = this.input.keys;
      this.input.movement.set((keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0));
      this.input.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
      this.input.crouch = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
    } else {
      this.input.movement.copy(this.input.mobileMovement);
      this.input.crouch = this.input.mobileCrouch;
    }
  }

  start() {
    this.sound.ensure();
    this.sound.setVolume(this.settings.volume);
    this.started = true;
    this.playing = true;
    this.mission?.start();
    this.dom.start.classList.add('hidden');
    this.dom.hud.classList.remove('hidden');
    if (this.device.mobile) this.mobileControls.setVisible(true);
    else this.dom.canvas.requestPointerLock?.().catch?.(() => {});
    this.showToast('MOVE TO RELAY A // PRESS E TO SYNC');
  }

  pause() {
    this.playing = false;
    this.dom.pause.classList.remove('hidden');
    this.input.fire = false; this.input.aim = false; this.input.sprint = false;
    if (document.pointerLockElement === this.dom.canvas) document.exitPointerLock?.();
  }

  resume() {
    this.sound.ensure();
    this.playing = true;
    this.dom.pause.classList.add('hidden');
    if (!this.device.mobile) this.dom.canvas.requestPointerLock?.().catch?.(() => {});
  }

  switchTab(tab) {
    document.querySelectorAll('.menu-tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
    $('#settingsPanel').classList.toggle('hidden', tab !== 'settings');
    $('#briefPanel').classList.toggle('hidden', tab !== 'brief');
  }

  applyPreset(preset) {
    this.settings = { ...this.settings, ...presets[preset], preset };
    this.applySettings();
    this.showToast(`${preset.toUpperCase()} GRAPHICS APPLIED`);
  }

  applySettings() {
    this.renderer.shadowMap.enabled = this.settings.shadowQuality > 0;
    this.post.setSettings(this.settings);
    this.particles.setDensity(this.settings.particleDensity);
    this.world.setGraphics(this.settings);
    this.player.setSensitivity(this.settings.sensitivity);
    this.player.setInvertLook(this.settings.invertY);
    this.sound.setVolume(this.settings.volume);
    this.resize();
    this.updateSettingsUI();
    this.saveSettings();
  }

  updateSettingsUI() {
    document.querySelectorAll('[data-preset]').forEach((button) => button.classList.toggle('active', button.dataset.preset === this.settings.preset));
    $('#resolutionScale').value = Math.round(this.settings.resolutionScale * 100); $('#resolutionOutput').textContent = `${Math.round(this.settings.resolutionScale * 100)}%`;
    $('#particleDensity').value = Math.round(this.settings.particleDensity * 100); $('#particleOutput').textContent = `${Math.round(this.settings.particleDensity * 100)}%`;
    $('#dynamicLights').value = this.settings.dynamicLights; $('#lightsOutput').textContent = this.settings.dynamicLights;
    $('#sensitivity').value = this.settings.sensitivity; $('#sensitivityOutput').textContent = `${this.settings.sensitivity.toFixed(1)}×`;
    $('#volume').value = Math.round(this.settings.volume * 100); $('#volumeOutput').textContent = `${Math.round(this.settings.volume * 100)}%`;
    $('#shadowQuality').value = this.settings.shadowQuality;
    $('#bloomToggle').checked = this.settings.bloom; $('#aoToggle').checked = this.settings.ao; $('#grainToggle').checked = this.settings.grain; $('#aaToggle').checked = this.settings.antialias; $('#fpsToggle').checked = this.settings.fps; $('#invertToggle').checked = this.settings.invertY;
  }

  resize() {
    if (!this.renderer) return;
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const pixelCap = this.device.mobile ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelCap) * this.settings.resolutionScale);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.post?.setSize(width, height, this.settings.resolutionScale);
  }

  fullscreen() {
    const request = document.documentElement.requestFullscreen;
    if (!request) { this.showToast('FULL SCREEN NOT AVAILABLE'); return; }
    request.call(document.documentElement).catch(() => this.showToast('FULL SCREEN REQUEST REJECTED'));
  }

  handleVisibility() {
    if (document.hidden && this.playing) { this.hiddenBeforeVisibility = true; this.pause(); }
    else if (!document.hidden && this.hiddenBeforeVisibility) { this.hiddenBeforeVisibility = false; this.showToast('SIMULATION PAUSED'); }
  }

  onTargetHit(target, details = {}) {
    const defeated = target.health <= 0;
    this.hitMarkerTimer = details.headshot ? .42 : .25;
    this.score += details.headshot ? 150 : defeated ? 100 : 25;
    if (defeated) {
      this.combo += 1;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
    } else {
      this.combo = Math.max(1, this.combo);
    }
    this.showToast(details.headshot ? 'HEADSHOT // +150' : defeated ? 'SECURITY UNIT DOWN // +100' : 'HIT CONFIRMED // ' + target.health + ' HP');
  }

  resetCombat() {
    this.world.resetTargets();
    this.enemySystem?.reset();
    this.mission?.reset();
    this.round = 1;
    this.score = 0;
    this.combo = 0;
    this.roundResetTimer = 0;
    this.hitMarkerTimer = 0;
    if (this.weapon) {
      this.weapon.ammo = this.weapon.magazineSize;
      this.weapon.reserve = 120;
      this.weapon.reloading = false;
    }
    $('#targetStatus').textContent = 'READY';
    $('#targetStatus').style.color = '';
  }

  setInteractionPrompt(message) {
    const prompt = $('#interactionPrompt');
    prompt.innerHTML = message;
    prompt.classList.toggle('hidden', !message);
  }

  updateMissionHud() {
    const state = this.mission?.getState();
    if (!state) return;
    $('#targetStatus').textContent = state.status;
    $('#targetStatus').style.color = state.state === 'blackout' ? '#ffb24d' : state.state === 'failed' ? '#ff5c66' : state.state === 'complete' ? '#76e8c6' : '';
    $('#missionObjective').textContent = state.objective;
    $('#missionProgress').textContent = state.progress;
  }

  onPlayerDamage(amount, source) {
    this.damageFlashTimer = window.setTimeout(() => this.dom.damageFlash?.classList.remove('visible'), 180);
    window.clearTimeout(this.damageFlashTimer);
    this.dom.damageFlash?.classList.add('visible');
    this.showToast('CONTACT // -' + amount + ' VITALS');
  }

  failMission() {
    this.mission?.fail();
  }

  endMission(success) {
    this.playing = false;
    this.dom.pause.classList.add('hidden');
    this.mobileControls?.setVisible(false);
    if (document.pointerLockElement === this.dom.canvas) document.exitPointerLock?.();
    $('#missionResultEyebrow').textContent = success ? 'OPERATION NIGHTFALL' : 'SYSTEM FAILURE';
    $('#missionResultTitle').textContent = success ? 'EXTRACTION COMPLETE' : 'FIELD FAILURE';
    $('#missionResultCopy').textContent = success ? 'Relay Yard 7 is back online. The route is clear.' : 'The relay yard overwhelmed your position. Reset and try a cleaner route.';
    this.dom.missionResult.classList.remove('hidden');
  }

  restartMission() {
    this.dom.missionResult.classList.add('hidden');
    this.dom.pause.classList.add('hidden');
    this.player.reset();
    this.resetCombat();
    this.mission.start();
    this.playing = true;
    if (this.device.mobile) this.mobileControls?.setVisible(true);
    else this.dom.canvas.requestPointerLock?.().catch?.(() => {});
  }

  showToast(message) {
    const toast = $('#centerToast');
    toast.textContent = message;
    toast.classList.add('visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 1600);
  }

  updateHud() {
    const weaponState = this.weapon.getState();
    const spread = this.weapon.getCrosshairSpread(this.player);
    $('#ammoValue').textContent = weaponState.ammo;
    $('#reserveValue').textContent = weaponState.reserve;
    $('#reloadText').classList.toggle('hidden', !weaponState.reloading);
    $('#crosshair').classList.toggle('is-aiming', weaponState.aiming);
    $('#hitMarker').classList.toggle('visible', this.hitMarkerTimer > 0);
    $('#crosshair').style.transform = `scale(${spread * (weaponState.aiming ? .68 : 1)})`;
    $('#stanceText').textContent = this.player.isCrouching ? 'CROUCHING' : this.player.isSprinting ? 'SPRINTING' : 'STANDING';
    $('#healthValue').textContent = this.player.health;
    $('#healthBar').style.width = `${this.player.health}%`;
    const degrees = (THREE.MathUtils.radToDeg(this.player.yaw) % 360 + 360) % 360;
    $('#compassDegrees').textContent = `${Math.round(degrees).toString().padStart(3, '0')}°`;
    $('#compassDirection').textContent = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8];
    $('#scoreValue').textContent = this.score.toString().padStart(5, '0');
    $('#comboValue').textContent = this.combo > 1 ? `x${this.combo}` : '—';
    $('#roundValue').textContent = this.round.toString().padStart(2, '0');
    if (this.settings.fps) $('#fpsCounter').textContent = `${Math.round(this.fps ?? 60)} FPS`;
  }

  frame(time) {
    const delta = Math.min(.05, this.lastFrame ? (time - this.lastFrame) / 1000 : .016);
    this.lastFrame = time;
    this.elapsed += delta;
    this.fps = this.fps ? THREE.MathUtils.lerp(this.fps, 1 / Math.max(.001, delta), .08) : 1 / Math.max(.001, delta);
    if (!this.renderer || document.hidden) return;
    this.syncInput();
    if (this.playing) {
      this.player.update(delta, this.input);
      this.physics.update(delta);
      this.mission?.update(delta, this.input);
      this.enemySystem?.update(delta, this.player);
      this.weapon.update(delta, this.player, this.input);
      this.particles.update(delta);
      this.world.update(delta);
      if (this.roundResetTimer > 0) {
        this.roundResetTimer -= delta;
        if (this.roundResetTimer <= 0) { this.round += 1; this.world.resetTargets(); this.combo = 0; $('#targetStatus').textContent = 'ROUND ACTIVE'; $('#targetStatus').style.color = ''; this.showToast(`ROUND ${this.round.toString().padStart(2, '0')} // TARGETS LIVE`); }
      }
      this.hitMarkerTimer = Math.max(0, this.hitMarkerTimer - delta);
      this.updateHud();
    } else {
      this.idleInput.isMobile = this.input.isMobile;
      this.player.update(delta, this.idleInput);
      this.weapon.update(delta, this.player, this.idleInput);
      this.particles.update(delta);
      this.world.update(delta);
    }
    this.input.lookX = 0; this.input.lookY = 0; this.input.jumpPressed = false; this.input.reloadPressed = false; this.input.interactPressed = false;
    this.post.render(this.scene, this.camera, this.elapsed);
  }

  showError(error) {
    console.error(error);
    this.dom.loading.classList.add('hidden');
    this.dom.start.classList.add('hidden');
    this.dom.error.classList.remove('hidden');
    this.dom.errorMessage.textContent = error?.message ?? 'The renderer could not be initialized. Reload and try again.';
  }
}

const app = new GameApp();
app.init();
