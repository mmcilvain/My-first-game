import { AdditiveBlending, BufferAttribute, BufferGeometry, CircleGeometry, Mesh, MeshBasicMaterial, Points, PointsMaterial, Vector3 } from 'three';

const particleTypes = {
  dust: { color: [0.62, 0.69, 0.62], life: .7, gravity: -.6, drag: .88 },
  sparks: { color: [1, .55, .18], life: .28, gravity: -8, drag: .84 },
  smoke: { color: [.38, .45, .4], life: 1.2, gravity: .35, drag: .93 },
  muzzle: { color: [1, .76, .32], life: .22, gravity: -1, drag: .82 },
  debris: { color: [.48, .42, .32], life: .55, gravity: -7, drag: .8 },
};

export class ParticleSystem {
  constructor(scene, settings = {}) {
    this.scene = scene;
    this.maxParticles = 1200;
    this.density = settings.particleDensity ?? .7;
    this.particles = Array.from({ length: this.maxParticles }, () => ({ active: false, life: 0, maxLife: 1, gravity: 0, drag: 1, r: 0, g: 0, b: 0, ambient: false }));
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new BufferAttribute(this.colors, 3));
    this.material = new PointsMaterial({ size: .075, vertexColors: true, transparent: true, opacity: .75, depthWrite: false, blending: AdditiveBlending, sizeAttenuation: true });
    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    this.nextParticle = 0;
    this.ambientCount = 0;
    this.decals = [];
    this.decalCursor = 0;
    this.decalNormal = new Vector3(0, 0, 1);
    this.decalGeometry = new CircleGeometry(.075, 8);
    this.decalMaterial = new MeshBasicMaterial({ color: 0x0e1815, transparent: true, opacity: .66, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    for (let i = 0; i < 64; i += 1) {
      const decal = new Mesh(this.decalGeometry, this.decalMaterial);
      decal.visible = false;
      decal.renderOrder = 4;
      this.scene.add(decal);
      this.decals.push(decal);
    }
    this.seedAmbient();
  }

  seedAmbient() {
    const desired = Math.round(110 * this.density);
    this.ambientCount = desired;
    for (let i = 0; i < desired; i += 1) {
      const particle = this.particles[i];
      particle.active = true;
      particle.ambient = true;
      particle.life = 999;
      particle.maxLife = 999;
      particle.r = .25 + (i % 5) * .04;
      particle.g = .42 + (i % 3) * .05;
      particle.b = .34 + (i % 4) * .04;
      const index = i * 3;
      this.positions[index] = ((i * 17) % 840) / 10 - 42;
      this.positions[index + 1] = .5 + ((i * 29) % 66) / 10;
      this.positions[index + 2] = ((i * 31) % 460) / 10 - 23;
      this.colors[index] = particle.r;
      this.colors[index + 1] = particle.g;
      this.colors[index + 2] = particle.b;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  setDensity(density) {
    this.density = Math.max(.2, Math.min(1, density));
    const desiredAmbient = Math.round(110 * this.density);
    for (let i = 0; i < 110; i += 1) {
      this.particles[i].active = i < desiredAmbient;
      this.particles[i].ambient = i < desiredAmbient;
    }
    this.ambientCount = desiredAmbient;
  }

  findSlot() {
    const maxDynamic = this.ambientCount + Math.round((this.maxParticles - 110) * this.density);
    for (let i = 0; i < maxDynamic; i += 1) {
      const index = this.ambientCount + ((this.nextParticle + i) % Math.max(1, maxDynamic - this.ambientCount));
      if (!this.particles[index].active || this.particles[index].ambient) { this.nextParticle = index + 1; return index; }
    }
    const index = this.ambientCount + (this.nextParticle++ % Math.max(1, maxDynamic - this.ambientCount));
    return index;
  }

  spawn(position, velocity, type = 'dust', scale = 1) {
    const slot = this.findSlot();
    const config = particleTypes[type] ?? particleTypes.dust;
    const particle = this.particles[slot];
    particle.active = true;
    particle.ambient = false;
    particle.life = config.life * (.7 + Math.random() * .6);
    particle.maxLife = particle.life;
    particle.gravity = config.gravity;
    particle.drag = config.drag;
    particle.r = config.color[0]; particle.g = config.color[1]; particle.b = config.color[2];
    particle.vx = velocity.x * scale; particle.vy = velocity.y * scale; particle.vz = velocity.z * scale;
    const index = slot * 3;
    this.positions[index] = position.x;
    this.positions[index + 1] = position.y;
    this.positions[index + 2] = position.z;
    this.colors[index] = particle.r;
    this.colors[index + 1] = particle.g;
    this.colors[index + 2] = particle.b;
  }

  emit(position, type, count = 8, normal = null) {
    const direction = new Vector3();
    for (let i = 0; i < Math.round(count * this.density); i += 1) {
      direction.set(Math.random() - .5, Math.random() - .25, Math.random() - .5);
      if (normal) direction.addScaledVector(normal, .7);
      direction.normalize().multiplyScalar(.5 + Math.random() * 2.2);
      this.spawn(position, direction, type, 1);
    }
  }

  emitImpact(point, normal, material = 'concrete') {
    const type = material === 'metal' ? 'sparks' : material === 'glass' ? 'debris' : 'dust';
    this.emit(point, type, material === 'metal' ? 11 : 8, normal);
    if (material !== 'metal') this.emit(point, 'smoke', 2, normal);
    this.placeDecal(point, normal, material);
  }

  emitMuzzle(point, direction) {
    this.emit(point, 'muzzle', 8, direction);
    this.emit(point, 'smoke', 3, direction);
  }

  placeDecal(point, normal, material = 'concrete') {
    const decal = this.decals[this.decalCursor];
    this.decalCursor = (this.decalCursor + 1) % this.decals.length;
    decal.visible = true;
    decal.position.copy(point).addScaledVector(normal, .008);
    this.decalNormal.copy(normal).normalize();
    decal.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), this.decalNormal);
    const size = material === 'metal' ? .055 : material === 'glass' ? .065 : .08;
    decal.scale.set(size, size, size);
    decal.material.color.set(material === 'metal' ? 0x3a2413 : material === 'glass' ? 0x6d8d83 : 0x131b18);
  }

  update(delta) {
    for (let i = 0; i < this.maxParticles; i += 1) {
      const particle = this.particles[i];
      if (!particle.active) { this.positions[i * 3 + 1] = -100; continue; }
      const index = i * 3;
      if (particle.ambient) {
        this.positions[index + 1] += delta * (.04 + (i % 4) * .008);
        this.positions[index] += Math.sin(performance.now() * .00035 + i) * delta * .015;
        if (this.positions[index + 1] > 7.3) this.positions[index + 1] = .35;
        continue;
      }
      particle.life -= delta;
      if (particle.life <= 0) { particle.active = false; this.positions[index + 1] = -100; continue; }
      particle.vy += particle.gravity * delta;
      particle.vx *= particle.drag; particle.vy *= particle.drag; particle.vz *= particle.drag;
      this.positions[index] += particle.vx * delta;
      this.positions[index + 1] += particle.vy * delta;
      this.positions[index + 2] += particle.vz * delta;
      const fade = Math.max(0, particle.life / particle.maxLife);
      this.colors[index] = particle.r * fade;
      this.colors[index + 1] = particle.g * fade;
      this.colors[index + 2] = particle.b * fade;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
    this.decalGeometry.dispose();
    this.decalMaterial.dispose();
    this.decals.forEach((decal) => this.scene.remove(decal));
  }
}
