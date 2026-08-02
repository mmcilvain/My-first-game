import { AdditiveBlending, BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Group, Line, LineBasicMaterial, MathUtils, Mesh, MeshBasicMaterial, PointLight, Raycaster, SphereGeometry, Vector3 } from 'three';

function part(geometry, material, position, rotation = [0, 0, 0]) {
  const object = new Mesh(geometry, material);
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.castShadow = true;
  return object;
}

export class WeaponSystem {
  constructor(camera, world, physics, particles, audio, callbacks = {}) {
    this.camera = camera;
    this.world = world;
    this.physics = physics;
    this.particles = particles;
    this.audio = audio;
    this.callbacks = callbacks;
    this.group = new Group();
    this.group.name = 'Vanta9Viewmodel';
    this.camera.add(this.group);
    this.materials = world.materials;
    this.raycaster = new Raycaster();
    this.rayOrigin = new Vector3();
    this.rayDirection = new Vector3();
    this.muzzlePosition = new Vector3();
    this.tracerEnd = new Vector3();
    this.tracerStart = new Vector3();
    this.impactNormal = new Vector3(0, 0, 1);
    this.currentPosition = new Vector3();
    this.currentRotation = new Vector3();
    this.hipPosition = new Vector3();
    this.aimPosition = new Vector3();
    this.aimBlend = 0;
    this.recoil = 0;
    this.fireCooldown = 0;
    this.reloadTimer = 0;
    this.reloading = false;
    this.ammo = 30;
    this.reserve = 120;
    this.magazineSize = 30;
    this.fireInterval = .105;
    this.damage = 34;
    this.time = 0;
    this.tracerTimer = 0;
    this.shellCursor = 0;
    this.shells = [];
    this.shellStates = [];
    this.muzzleLight = new PointLight(0xffc35c, 0, 4, 2);
    this.muzzleFlash = new Mesh(new SphereGeometry(.08, 8, 6), new MeshBasicMaterial({ color: 0xffd37b, transparent: true, opacity: 0 }));
    this.tracer = new Line(new BufferGeometry(), new LineBasicMaterial({ color: 0xffcf75, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }));
    this.tracer.geometry.setAttribute('position', new Float32BufferAttribute(6, 3));
    this.tracer.frustumCulled = false;
    this.world.root.parent.add(this.tracer);
    this.shellGeometry = new CylinderGeometry(.018, .024, .085, 6);
    for (let i = 0; i < 18; i += 1) {
      const shell = new Mesh(this.shellGeometry, this.materials.amberHot);
      shell.visible = false; shell.castShadow = false; shell.renderOrder = 5; this.group.add(shell);
      this.shells.push(shell); this.shellStates.push({ active: false, life: 0, vx: 0, vy: 0, vz: 0, spin: 0 });
    }
    this.buildViewmodel();
  }

  buildViewmodel() {
    const receiver = part(new BoxGeometry(.24, .22, .72), this.materials.metalDark, [0, 0, 0]);
    receiver.add(part(new BoxGeometry(.16, .08, .36), this.materials.metal, [0, .13, -.02]));
    this.group.add(receiver);
    const barrel = part(new CylinderGeometry(.045, .055, .48, 10), this.materials.black, [0, .02, -.58], [Math.PI / 2, 0, 0]);
    this.group.add(barrel);
    const muzzle = part(new CylinderGeometry(.08, .06, .11, 10), this.materials.metalDark, [0, .02, -.84], [Math.PI / 2, 0, 0]);
    this.group.add(muzzle);
    const magazine = part(new BoxGeometry(.15, .34, .22), this.materials.militaryDark, [0, -.28, .08], [.2, 0, 0]);
    this.group.add(magazine);
    const grip = part(new BoxGeometry(.13, .29, .15), this.materials.rubber, [0, -.25, .34], [-.17, 0, 0]);
    this.group.add(grip);
    const stock = part(new BoxGeometry(.18, .18, .38), this.materials.militaryPaint, [0, -.01, .53]);
    stock.add(part(new BoxGeometry(.23, .14, .1), this.materials.fabric, [0, -.04, .22]));
    this.group.add(stock);
    const rail = part(new BoxGeometry(.1, .05, .58), this.materials.black, [0, .16, -.12]);
    this.group.add(rail);
    this.group.add(part(new BoxGeometry(.08, .14, .08), this.materials.cyan, [0, .24, -.31]));
    const handGeometry = new SphereGeometry(.12, 10, 8);
    const glove = this.materials.fabric;
    this.group.add(part(handGeometry, glove, [-.18, -.19, .12], [0, 0, 0]));
    this.group.add(part(handGeometry, glove, [.15, -.19, .31], [0, 0, 0]));
    this.muzzleFlash.position.set(0, .02, -.9);
    this.muzzleLight.position.copy(this.muzzleFlash.position);
    this.group.add(this.muzzleFlash, this.muzzleLight);
    this.group.position.set(.34, -.31, -.64);
  }

  update(delta, player, input) {
    this.time += delta;
    this.fireCooldown = Math.max(0, this.fireCooldown - delta);
    if (this.reloading) {
      this.reloadTimer -= delta;
      if (this.reloadTimer <= 0) this.finishReload();
    }
    const targetAim = input.aim ? 1 : 0;
    this.aimBlend = MathUtils.damp(this.aimBlend, targetAim, 13, delta);
    if (input.reloadPressed) this.reload();
    if (input.fire && !this.reloading) this.fire(player);
    this.recoil = MathUtils.damp(this.recoil, 0, 16, delta);
    const moving = player.velocity.lengthSq() > .05;
    const sway = moving ? .012 : .006;
    const sprintPose = player.isSprinting ? 1 : 0;
    const bobRate = player.isSprinting ? 11 : 7;
    const bob = moving ? Math.sin(this.time * bobRate) * sway : Math.sin(this.time * 1.6) * .003;
    const idle = Math.cos(this.time * 1.2) * .003;
    this.hipPosition.set(.34 + bob, -.31 + idle, -.64);
    this.aimPosition.set(.06 + bob * .25, -.22 + idle * .25, -.56);
    this.currentPosition.lerpVectors(this.hipPosition, this.aimPosition, this.aimBlend);
    this.currentPosition.y -= sprintPose * .13;
    this.currentPosition.z += sprintPose * .14;
    this.group.position.copy(this.currentPosition);
    this.currentRotation.set(-this.recoil * .32 + bob * .8, bob * .45, this.recoil * .15 + sprintPose * -.24);
    this.group.rotation.x = MathUtils.damp(this.group.rotation.x, this.currentRotation.x, 18, delta);
    this.group.rotation.y = MathUtils.damp(this.group.rotation.y, this.currentRotation.y, 18, delta);
    this.group.rotation.z = MathUtils.damp(this.group.rotation.z, this.currentRotation.z, 18, delta);
    this.muzzleLight.intensity = this.muzzleFlash.material.opacity * 5;
    this.muzzleFlash.material.opacity = Math.max(0, this.muzzleFlash.material.opacity - delta * 18);
    this.muzzleLight.intensity = this.muzzleFlash.material.opacity * 5;
    this.updateShells(delta);
    this.tracerTimer = Math.max(0, this.tracerTimer - delta);
    this.tracer.visible = this.tracerTimer > 0;
    this.tracer.material.opacity = Math.min(1, this.tracerTimer * 24) * .72;
    const targetFov = player.settings.fov - this.aimBlend * 11 + sprintPose * 6;
    this.camera.fov = MathUtils.damp(this.camera.fov, targetFov, 15, delta);
    this.camera.updateProjectionMatrix();
    this.callbacks.onState?.(this.getState());
  }

  fire(player) {
    if (this.fireCooldown > 0) return;
    if (this.ammo <= 0) { this.audio?.dry?.(); this.fireCooldown = .2; return; }
    this.ammo -= 1;
    this.fireCooldown = this.fireInterval;
    this.recoil = Math.min(.13, this.recoil + .08);
    this.muzzleFlash.material.opacity = 1;
    this.muzzleLight.intensity = 5;
    this.audio?.shot?.();
    player.getEyePosition(this.rayOrigin);
    player.getForward(this.rayDirection);
    this.particles.emitMuzzle(this.rayOrigin.clone().addScaledVector(this.rayDirection, .65), this.rayDirection);

    this.raycaster.set(this.rayOrigin, this.rayDirection);
    this.raycaster.far = 120;
    const targetHits = this.raycaster.intersectObjects(this.world.targetMeshes, false);
    const wallHit = this.physics.raycast(this.rayOrigin, this.rayDirection, 120);
    const targetHit = targetHits[0];
    const targetIsClear = targetHit && (!wallHit || targetHit.distance < wallHit.distance);
    const hitPoint = targetIsClear ? targetHit.point : wallHit?.point;
    this.tracerStart.copy(this.rayOrigin);
    this.tracerEnd.copy(hitPoint ?? this.rayOrigin);
    if (!hitPoint) this.tracerEnd.addScaledVector(this.rayDirection, 24);
    const tracerPositions = this.tracer.geometry.attributes.position.array;
    tracerPositions[0] = this.tracerStart.x; tracerPositions[1] = this.tracerStart.y; tracerPositions[2] = this.tracerStart.z;
    tracerPositions[3] = this.tracerEnd.x; tracerPositions[4] = this.tracerEnd.y; tracerPositions[5] = this.tracerEnd.z;
    this.tracer.geometry.attributes.position.needsUpdate = true;
    this.tracerTimer = .055;
    this.ejectShell();
    if (targetIsClear) {
      const targetData = targetHit.object.userData.target;
      if (targetData) {
        const headshot = targetHit.object.userData.hitZone === 'head';
        const damage = headshot ? 100 : this.damage;
        targetData.health = Math.max(0, targetData.health - damage);
        const group = targetData.group;
        group.userData.hitTimer = .45;
        group.userData.downTimer = targetData.health <= 0 ? 2.5 : 0;
        group.rotation.z = targetData.health <= 0 ? -.9 : (Math.random() > .5 ? .14 : -.14);
        this.particles.emitImpact(targetHit.point, targetHit.face?.normal ?? this.impactNormal, 'target');
        this.audio?.impact?.('target');
        this.callbacks.onTargetHit?.(targetData, { headshot, damage, point: targetHit.point });
      }
    } else if (wallHit) {
      this.particles.emitImpact(wallHit.point, wallHit.normal, wallHit.material);
      this.audio?.impact?.(wallHit.material);
    }
  }

  reload() {
    if (this.reloading || this.ammo >= this.magazineSize || this.reserve <= 0) return;
    this.reloading = true;
    this.reloadTimer = 1.55;
    this.audio?.reload?.();
  }

  finishReload() {
    const needed = this.magazineSize - this.ammo;
    const amount = Math.min(needed, this.reserve);
    this.ammo += amount;
    this.reserve -= amount;
    this.reloading = false;
    this.audio?.reloadDone?.();
  }

  ejectShell() {
    const index = this.shellCursor++ % this.shells.length;
    const shell = this.shells[index];
    const state = this.shellStates[index];
    shell.visible = true;
    shell.position.set(.2, -.08, .13);
    shell.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
    state.active = true; state.life = 1.05; state.vx = .7 + Math.random() * .45; state.vy = .7 + Math.random() * .6; state.vz = .05 + Math.random() * .3; state.spin = 16 + Math.random() * 15;
  }

  updateShells(delta) {
    for (let i = 0; i < this.shells.length; i += 1) {
      const state = this.shellStates[i];
      if (!state.active) continue;
      state.life -= delta;
      if (state.life <= 0) { state.active = false; this.shells[i].visible = false; continue; }
      const shell = this.shells[i];
      state.vy -= 3.8 * delta;
      state.vx *= .985; state.vy *= .985; state.vz *= .985;
      shell.position.x += state.vx * delta; shell.position.y += state.vy * delta; shell.position.z += state.vz * delta;
      shell.rotation.x += state.spin * delta; shell.rotation.z += state.spin * .7 * delta;
    }
  }

  getCrosshairSpread(player) {
    return 1 + Math.min(1.6, player.velocity.length() * .075) + this.recoil * 3 - this.aimBlend * .55;
  }

  getState() { return { ammo: this.ammo, reserve: this.reserve, reloading: this.reloading, aiming: this.aimBlend > .6, spread: this.aimBlend }; }

  dispose() { this.group.traverse((object) => { object.geometry?.dispose?.(); if (object.material?.dispose) object.material.dispose(); }); this.tracer.geometry.dispose(); this.tracer.material.dispose(); this.world.root.parent.remove(this.tracer); }
}
