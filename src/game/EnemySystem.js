import { MathUtils, Vector3 } from 'three';

export class EnemySystem {
  constructor(world, physics, particles, audio, callbacks = {}) {
    this.world = world;
    this.physics = physics;
    this.particles = particles;
    this.audio = audio;
    this.callbacks = callbacks;
    this.time = 0;
    this.active = false;
    this.playerEye = new Vector3();
    this.enemies = world.targets.map((group, index) => {
      const targetData = group.userData.targetData;
      targetData.kind = 'enemy';
      targetData.maxHealth = targetData.maxHealth ?? 100;
      const state = {
        index,
        group,
        targetData,
        home: group.position.clone(),
        attackTimer: 0.9 + index * 0.17,
        alerted: false,
        dead: false,
        reactionTimer: 0,
        origin: new Vector3(),
        toPlayer: new Vector3(),
        direction: new Vector3(),
      };
      group.userData.enemyState = state;
      return state;
    });
  }

  reset() {
    this.time = 0;
    this.active = false;
    this.enemies.forEach((enemy) => {
      enemy.targetData.health = enemy.targetData.maxHealth;
      enemy.attackTimer = 0.9 + enemy.index * 0.17;
      enemy.alerted = false;
      enemy.dead = false;
      enemy.reactionTimer = 0;
      enemy.group.position.copy(enemy.home);
      enemy.group.rotation.set(0, 0, 0);
      enemy.group.userData.downTimer = 0;
      enemy.group.userData.hitTimer = 0;
    });
  }

  setAlerted(active = true) {
    this.active = active;
    this.enemies.forEach((enemy) => {
      enemy.alerted = active;
      if (active && enemy.targetData.health > 0) {
        enemy.attackTimer = Math.min(enemy.attackTimer, 0.8 + enemy.index * 0.12);
      }
    });
  }

  onHit(targetData, details = {}) {
    const enemy = this.enemies.find((item) => item.targetData === targetData);
    if (!enemy) return;
    enemy.alerted = true;
    enemy.reactionTimer = details.headshot ? 0.5 : 0.28;
    if (targetData.health <= 0) {
      enemy.dead = true;
      enemy.attackTimer = Infinity;
    }
  }

  canSee(origin, direction, distance) {
    const wallHit = this.physics.raycast(origin, direction, distance);
    return !wallHit || wallHit.distance > distance - 0.35;
  }

  update(delta, player) {
    this.time += delta;
    const playerEye = player.getEyePosition(this.playerEye);

    for (const enemy of this.enemies) {
      const { group, targetData } = enemy;
      if (targetData.health <= 0 || group.userData.downTimer > 0) {
        enemy.dead = true;
        continue;
      }
      if (enemy.reactionTimer > 0) enemy.reactionTimer -= delta;
      if (!this.active) continue;

      const { origin, toPlayer, direction } = enemy;
      origin.copy(group.position);
      origin.y += 1.7;
      toPlayer.copy(playerEye).sub(origin);
      const distance = toPlayer.length();
      if (distance > 30) continue;

      direction.copy(toPlayer).normalize();
      if (!this.canSee(origin, direction, distance)) continue;

      enemy.alerted = true;
      const targetYaw = Math.atan2(direction.x, direction.z);
      group.rotation.y = MathUtils.damp(group.rotation.y, targetYaw, 8, delta);
      enemy.attackTimer -= delta;
      if (enemy.attackTimer <= 0) this.attack(enemy, player, origin, direction);
    }
  }

  attack(enemy, player, origin, direction) {
    enemy.attackTimer = 1.2 + Math.random() * 0.9;
    this.particles?.emitMuzzle?.(origin.clone().addScaledVector(direction, 0.15), direction);
    this.audio?.enemyShot?.();
    const amount = Math.round(7 + Math.random() * 5);
    if (player.takeDamage?.(amount, 'security unit')) {
      this.callbacks.onAttack?.({ enemy, amount });
    }
  }

  getAliveCount() {
    return this.enemies.filter((enemy) => enemy.targetData.health > 0).length;
  }

  getState() {
    return {
      active: this.active,
      alive: this.getAliveCount(),
      total: this.enemies.length,
    };
  }
}
