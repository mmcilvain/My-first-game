import { Vector3 } from 'three';

const UP = new Vector3(0, 1, 0);

function overlapsAabb(position, radius, height, box) {
  return position.x + radius > box.min.x && position.x - radius < box.max.x &&
    position.z + radius > box.min.z && position.z - radius < box.max.z &&
    position.y + height > box.min.y && position.y < box.max.y;
}

export class PhysicsSystem {
  constructor(collisionBoxes = []) {
    this.collisionBoxes = collisionBoxes;
    this.bodies = [];
    this.accumulator = 0;
    this.fixedStep = 1 / 60;
    this.maxSubsteps = 4;
    this.gravity = -18;
    this._candidate = new Vector3();
    this._bodyTarget = new Vector3();
    this._rayDirection = new Vector3();
    this._rayOrigin = new Vector3();
  }

  addBody(object, options = {}) {
    if (this.bodies.length >= 48) return null;
    const body = {
      object,
      radius: options.radius ?? .5,
      height: options.height ?? 1,
      mass: options.mass ?? 10,
      velocity: new Vector3(),
      grounded: false,
      sleeping: false,
      sleepTimer: 0,
      active: true,
    };
    object.position.y = options.position?.y ?? object.position.y;
    this.bodies.push(body);
    return body;
  }

  resolvePlayer(current, desired, radius, height) {
    this._candidate.copy(current);
    let grounded = false;
    const moveAxis = (axis) => {
      const before = this._candidate[axis];
      this._candidate[axis] = desired[axis];
      for (const box of this.collisionBoxes) {
        if (!overlapsAabb(this._candidate, radius, height, box)) continue;
        if (axis === 'x') this._candidate.x = desired.x > current.x ? box.min.x - radius : box.max.x + radius;
        if (axis === 'z') this._candidate.z = desired.z > current.z ? box.min.z - radius : box.max.z + radius;
        break;
      }
      if (!Number.isFinite(this._candidate[axis])) this._candidate[axis] = before;
    };
    moveAxis('x');
    moveAxis('z');

    const beforeY = this._candidate.y;
    this._candidate.y = desired.y;
    for (const box of this.collisionBoxes) {
      if (!overlapsAabb(this._candidate, radius, height, box)) continue;
      if (desired.y <= current.y) {
        this._candidate.y = box.max.y;
        grounded = true;
      } else {
        this._candidate.y = box.min.y - height;
      }
      break;
    }
    if (!Number.isFinite(this._candidate.y)) this._candidate.y = beforeY;
    return { position: this._candidate, grounded };
  }

  hasHeadroom(position, radius, fromHeight, toHeight) {
    const extension = toHeight - fromHeight;
    if (extension <= 0) return true;
    const check = this._candidate.copy(position);
    check.y += fromHeight;
    return !this.collisionBoxes.some((box) => check.x + radius > box.min.x && check.x - radius < box.max.x && check.z + radius > box.min.z && check.z - radius < box.max.z && check.y + extension > box.min.y && check.y < box.max.y);
  }

  raycast(origin, direction, maxDistance = 100) {
    this._rayOrigin.copy(origin);
    this._rayDirection.copy(direction).normalize();
    let closest = null;
    for (const box of this.collisionBoxes) {
      const hit = this.intersectBox(this._rayOrigin, this._rayDirection, box, maxDistance);
      if (hit && (!closest || hit.distance < closest.distance)) closest = hit;
    }
    return closest;
  }

  intersectBox(origin, direction, box, maxDistance) {
    let tMin = 0;
    let tMax = maxDistance;
    let nearAxis = null;
    let nearSign = 0;
    const axes = ['x', 'y', 'z'];
    for (const axis of axes) {
      const originAxis = origin[axis];
      const directionAxis = direction[axis];
      if (Math.abs(directionAxis) < 0.00001) {
        if (originAxis < box.min[axis] || originAxis > box.max[axis]) return null;
        continue;
      }
      let t1 = (box.min[axis] - originAxis) / directionAxis;
      let t2 = (box.max[axis] - originAxis) / directionAxis;
      let sign = -1;
      if (t1 > t2) { const swap = t1; t1 = t2; t2 = swap; sign = 1; }
      if (t1 > tMin) { tMin = t1; nearAxis = axis; nearSign = sign; }
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return null;
    }
    if (tMin < 0 || tMin > maxDistance) return null;
    const point = this._rayOrigin.clone().addScaledVector(this._rayDirection, tMin);
    const normal = new Vector3();
    if (nearAxis) normal[nearAxis] = nearSign;
    return { distance: tMin, point, normal, material: box.material ?? 'concrete', box };
  }

  applyImpulse(object, impulse) {
    const body = this.bodies.find((item) => item.object === object);
    if (!body) return;
    body.velocity.addScaledVector(impulse, 1 / Math.max(1, body.mass));
    body.sleeping = false;
    body.sleepTimer = 0;
  }

  update(delta) {
    this.accumulator += Math.min(delta, .1);
    let substeps = 0;
    while (this.accumulator >= this.fixedStep && substeps < this.maxSubsteps) {
      this.step(this.fixedStep);
      this.accumulator -= this.fixedStep;
      substeps += 1;
    }
    if (substeps === this.maxSubsteps) this.accumulator = 0;
  }

  step(step) {
    for (const body of this.bodies) {
      if (!body.active || body.sleeping) continue;
      body.velocity.y += this.gravity * step;
      const target = this._bodyTarget.copy(body.object.position).addScaledVector(body.velocity, step);
      const resolved = this.resolvePlayer(body.object.position, target, body.radius, body.height);
      if (resolved.grounded && body.velocity.y < 0) body.velocity.y = 0;
      if (!resolved.grounded && body.object.position.y <= 0.02 && target.y <= body.object.position.y) body.velocity.y = 0;
      body.object.position.copy(resolved.position);
      body.velocity.x *= .94;
      body.velocity.z *= .94;
      if (body.velocity.lengthSq() < .006 && resolved.grounded) body.sleepTimer += step;
      else body.sleepTimer = 0;
      if (body.sleepTimer > .85) { body.sleeping = true; body.velocity.set(0, 0, 0); }
    }
  }

  wakeInRadius(point, radius, impulseStrength = 2) {
    const radiusSq = radius * radius;
    for (const body of this.bodies) {
      const offset = body.object.position.clone().sub(point);
      if (offset.lengthSq() > radiusSq) continue;
      offset.y = .2;
      offset.normalize().multiplyScalar(impulseStrength);
      this.applyImpulse(body.object, offset);
    }
  }

  dispose() {
    this.bodies.length = 0;
    this.collisionBoxes.length = 0;
  }
}

export { UP };
