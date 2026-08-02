import { MathUtils, Vector2, Vector3 } from 'three';

const WORLD_UP = new Vector3(0, 1, 0);

export class PlayerController {
  constructor(camera, physics, spawn, options = {}) {
    this.camera = camera;
    this.physics = physics;
    this.spawn = spawn.clone();
    this.position = spawn.clone();
    this.velocity = new Vector3();
    this.desiredPosition = new Vector3();
    this.moveDirection = new Vector3();
    this.forward = new Vector3();
    this.right = new Vector3();
    this.lookVelocity = new Vector2();
    this.yaw = 0;
    this.pitch = 0;
    this.time = 0;
    this.grounded = false;
    this.isCrouching = false;
    this.isSprinting = false;
    this.radius = .38;
    this.standHeight = 1.72;
    this.crouchHeight = 1.12;
    this.eyeStand = 1.55;
    this.eyeCrouch = .98;
    this.currentEyeHeight = this.eyeStand;
    this.heightVelocity = 0;
    this.health = 100;
    this.dead = false;
    this.damageCooldown = 0;
    this.jumpBuffer = 0;
    this.coyoteTimer = 0;
    this.stepTimer = .18;
    this.callbacks = options;
    this.settings = { sensitivity: 1, mobileSensitivity: .62, invertY: false, fov: 76, ...options };
    this.camera.rotation.order = 'YXZ';
    this.camera.near = .04;
    this.camera.far = 130;
    this.camera.fov = this.settings.fov;
    this.camera.updateProjectionMatrix();
  }

  update(delta, input) {
    this.time += delta;
    this.damageCooldown = Math.max(0, this.damageCooldown - delta);
    if (this.dead) {
      this.updateCamera(delta, false);
      return;
    }
    this.jumpBuffer = input.jumpPressed ? .14 : Math.max(0, this.jumpBuffer - delta);
    this.coyoteTimer = this.grounded ? .11 : Math.max(0, this.coyoteTimer - delta);
    const sensitivity = (input.isMobile ? this.settings.mobileSensitivity : 1) * this.settings.sensitivity;
    this.yaw -= input.lookX * .0024 * sensitivity;
    this.pitch -= input.lookY * .0024 * sensitivity * (this.settings.invertY ? -1 : 1);
    this.pitch = MathUtils.clamp(this.pitch, -1.43, 1.43);
    this.lookVelocity.set(input.lookX, input.lookY).multiplyScalar(.0024);

    const wantsCrouch = input.crouch;
    if (!wantsCrouch && this.isCrouching && !this.physics.hasHeadroom(this.position, this.radius, this.crouchHeight, this.standHeight)) {
      this.isCrouching = true;
    } else {
      this.isCrouching = wantsCrouch;
    }
    const targetHeight = this.isCrouching ? this.crouchHeight : this.standHeight;
    const heightBlend = 1 - Math.exp(-delta * 13);
    this.currentEyeHeight = MathUtils.lerp(this.currentEyeHeight, this.isCrouching ? this.eyeCrouch : this.eyeStand, heightBlend);

    const movement = input.movement;
    this.forward.set(Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.right.set(Math.cos(this.yaw), 0, Math.sin(this.yaw));
    this.moveDirection.set(0, 0, 0).addScaledVector(this.forward, movement.y).addScaledVector(this.right, movement.x);
    if (this.moveDirection.lengthSq() > 1) this.moveDirection.normalize();
    const moving = this.moveDirection.lengthSq() > .002;
    this.isSprinting = input.sprint && moving && !this.isCrouching && input.movement.y > .15;
    const speed = this.isSprinting ? 7.9 : this.isCrouching ? 2.25 : 4.35;
    const acceleration = this.grounded ? (this.isSprinting ? 31 : 24) : 11;
    const targetVelocityX = this.moveDirection.x * speed;
    const targetVelocityZ = this.moveDirection.z * speed;
    this.velocity.x = MathUtils.damp(this.velocity.x, targetVelocityX, acceleration, delta);
    this.velocity.z = MathUtils.damp(this.velocity.z, targetVelocityZ, acceleration, delta);
    if (!moving && this.grounded) {
      this.velocity.x = MathUtils.damp(this.velocity.x, 0, 35, delta);
      this.velocity.z = MathUtils.damp(this.velocity.z, 0, 35, delta);
    }
    if (this.coyoteTimer > 0 && this.jumpBuffer > 0 && !this.isCrouching) {
      this.velocity.y = 7.15;
      this.grounded = false;
      this.coyoteTimer = 0;
      this.jumpBuffer = 0;
    }
    this.velocity.y += -19.2 * delta;
    this.desiredPosition.copy(this.position).addScaledVector(this.velocity, delta);
    const resolved = this.physics.resolvePlayer(this.position, this.desiredPosition, this.radius, targetHeight);
    this.position.copy(resolved.position);
    if (resolved.grounded && this.velocity.y < 0) this.velocity.y = 0;
    this.grounded = resolved.grounded;

    if (moving && this.grounded) {
      this.stepTimer -= delta;
      if (this.stepTimer <= 0) {
        this.callbacks.onStep?.(this.isSprinting ? 'sprint' : 'step');
        this.stepTimer = this.isSprinting ? .27 : this.isCrouching ? .48 : .38;
      }
    } else if (!moving) {
      this.stepTimer = Math.min(this.stepTimer, .12);
    }

    if (this.position.y < -8 || Math.abs(this.position.x) > 48 || Math.abs(this.position.z) > 34) this.reset();
    this.updateCamera(delta, moving);
  }

  updateCamera(delta, moving) {
    const bobRate = this.isSprinting ? 12 : 8;
    const bobAmount = moving && this.grounded ? (this.isSprinting ? .055 : .025) : 0;
    const bobX = Math.cos(this.time * bobRate) * bobAmount;
    const bobY = Math.abs(Math.sin(this.time * bobRate)) * bobAmount;
    this.camera.position.set(this.position.x + bobX, this.position.y + this.currentEyeHeight + bobY, this.position.z);
    const sway = MathUtils.damp(this.camera.rotation.z, -this.velocity.x * .008, 10, delta);
    this.camera.rotation.set(this.pitch, this.yaw, sway, 'YXZ');
    const targetFov = this.isSprinting ? this.settings.fov + 6 : this.settings.fov;
    this.camera.fov = MathUtils.damp(this.camera.fov, targetFov, 8, delta);
    this.camera.updateProjectionMatrix();
  }

  getForward(target = new Vector3()) {
    target.set(0, 0, -1).applyEuler(this.camera.rotation).normalize();
    return target;
  }

  getEyePosition(target = new Vector3()) {
    return target.copy(this.camera.position);
  }

  reset() {
    this.position.copy(this.spawn);
    this.velocity.set(0, 0, 0);
    this.health = 100;
    this.dead = false;
    this.damageCooldown = 0;
    this.grounded = false;
    this.yaw = 0;
    this.pitch = 0;
    this.isCrouching = false;
    this.currentEyeHeight = this.eyeStand;
  }

  takeDamage(amount, source = 'unknown') {
    if (this.dead || this.damageCooldown > 0) return false;
    this.damageCooldown = 0.3;
    this.health = MathUtils.clamp(this.health - amount, 0, 100);
    this.callbacks.onDamage?.(amount, source, this.health);
    if (this.health <= 0) {
      this.dead = true;
      this.velocity.set(0, 0, 0);
      this.callbacks.onDeath?.(source);
    }
    return true;
  }

  setSensitivity(value, mobile = false) {
    if (mobile) this.settings.mobileSensitivity = value;
    else this.settings.sensitivity = value;
  }

  setInvertLook(value) { this.settings.invertY = value; }

  getState() {
    return { health: this.health, dead: this.dead, grounded: this.grounded, crouching: this.isCrouching, sprinting: this.isSprinting, speed: this.velocity.length() };
  }
}
