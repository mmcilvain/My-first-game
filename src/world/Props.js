import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

function mesh(geometry, material, cast = true, receive = true) {
  const item = new THREE.Mesh(geometry, material);
  item.castShadow = cast;
  item.receiveShadow = receive;
  return item;
}

export function createCrate(materials, size = 1) {
  const group = new THREE.Group();
  const body = mesh(new RoundedBoxGeometry(size, size * .82, size, 3, Math.min(.08, size * .07)), materials.wood);
  body.position.y = size * .41;
  group.add(body);
  const bands = new THREE.Group();
  const bandGeometry = new THREE.BoxGeometry(size * .08, size * .86, size * 1.03);
  for (const x of [-size * .28, size * .28]) bands.add(mesh(bandGeometry, materials.metalDark));
  bands.position.y = size * .41;
  group.add(bands);
  const plankGeometry = new THREE.BoxGeometry(size * 1.01, size * .035, size * .035);
  for (const y of [size * .2, size * .62]) {
    const front = mesh(plankGeometry, materials.wood, false, true); front.position.set(0, y, size * .505);
    const back = mesh(plankGeometry, materials.wood, false, true); back.position.set(0, y, -size * .505);
    group.add(front, back);
  }
  group.userData = { type: 'crate', radius: size * .7, height: size * .82, mass: 22 };
  return group;
}

export function createInstancedCrates(materials, count, placements) {
  const geometry = new THREE.BoxGeometry(1.15, .9, 1.15);
  const instance = new THREE.InstancedMesh(geometry, materials.wood, count);
  instance.castShadow = true;
  instance.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < count; i += 1) {
    const placement = placements[i];
    matrix.compose(new THREE.Vector3(placement.x, placement.y ?? .45, placement.z), new THREE.Quaternion(), new THREE.Vector3(placement.scale ?? 1, placement.scale ?? 1, placement.scale ?? 1));
    instance.setMatrixAt(i, matrix);
  }
  instance.instanceMatrix.needsUpdate = true;
  instance.userData = { type: 'instanced-crates' };
  return instance;
}

export function createBarrel(materials, color = 'militaryDark') {
  const group = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(.42, .46, 1.05, 20), materials[color] ?? materials.militaryDark);
  body.position.y = .53;
  group.add(body);
  const rimGeometry = new THREE.TorusGeometry(.43, .035, 6, 14);
  for (const y of [.17, .88]) { const rim = mesh(rimGeometry, materials.metalDark); rim.rotation.x = Math.PI / 2; rim.position.y = y; group.add(rim); }
  const cap = mesh(new THREE.CylinderGeometry(.25, .25, .02, 12), materials.warning);
  cap.position.y = 1.06;
  group.add(cap);
  const label = mesh(new THREE.BoxGeometry(.22, .28, .018), materials.warning, false, true);
  label.position.set(0, .55, -.455);
  group.add(label);
  group.userData = { type: 'barrel', radius: .48, height: 1.06, mass: 32 };
  return group;
}

export function createBarrier(materials, width = 2.8) {
  const group = new THREE.Group();
  const slab = mesh(new RoundedBoxGeometry(width, .72, .42, 3, .08), materials.concreteDark);
  slab.position.y = .36;
  group.add(slab);
  const stripe = mesh(new THREE.BoxGeometry(width * .88, .035, .435), materials.warning, false, true);
  stripe.position.set(0, .43, 0);
  stripe.rotation.z = -.08;
  group.add(stripe);
  const cap = mesh(new THREE.BoxGeometry(width * .82, .055, .46), materials.trim, false, true);
  cap.position.y = .77;
  group.add(cap);
  group.userData = { type: 'barrier', radius: width * .5, height: .72, mass: 80 };
  return group;
}

export function createWeaponRack(materials) {
  const group = new THREE.Group();
  const frame = mesh(new THREE.BoxGeometry(2.2, 1.8, .12), materials.metalDark);
  frame.position.y = .9;
  group.add(frame);
  const shelfGeometry = new THREE.BoxGeometry(2.05, .08, .32);
  for (const y of [.32, .82, 1.32]) { const shelf = mesh(shelfGeometry, materials.metal); shelf.position.set(0, y, -.2); group.add(shelf); }
  const gunGeometry = new THREE.BoxGeometry(1.35, .09, .1);
  for (let i = 0; i < 3; i += 1) {
    const gun = mesh(gunGeometry, materials.black);
    gun.position.set(-.15 + i * .18, .46 + i * .5, -.34);
    gun.rotation.z = -.05;
    group.add(gun);
  }
  return group;
}

export function createTargetDummy(materials, id) {
  const group = new THREE.Group();
  group.name = `Target_${id}`;
  const torso = mesh(new RoundedBoxGeometry(.7, 1.1, .3, 3, .08), materials.target);
  torso.position.y = 1.34;
  torso.userData = { target: { id, health: 100, maxHealth: 100, group }, hitZone: 'body' };
  group.add(torso);
  const head = mesh(new THREE.IcosahedronGeometry(.28, 1), materials.target);
  head.position.y = 2.16;
  head.userData = { target: torso.userData.target, hitZone: 'head' };
  group.add(head);
  const chest = mesh(new THREE.CylinderGeometry(.22, .22, .02, 16), materials.targetAccent);
  chest.rotation.x = Math.PI / 2;
  chest.position.set(0, 1.42, -.17);
  chest.userData = torso.userData;
  group.add(chest);
  const armGeometry = new THREE.CylinderGeometry(.07, .09, .74, 8);
  for (const side of [-1, 1]) {
    const arm = mesh(armGeometry, materials.target, true, true);
    arm.position.set(side * .47, 1.37, 0);
    arm.rotation.z = side * -.12;
    group.add(arm);
  }
  const targetGlow = mesh(new THREE.TorusGeometry(.31, .022, 5, 16), materials.cyanHot, false, false);
  targetGlow.rotation.x = Math.PI / 2;
  targetGlow.position.set(0, 1.42, -.2);
  targetGlow.userData.targetGlow = true;
  group.add(targetGlow);
  const pole = mesh(new THREE.CylinderGeometry(.07, .07, 1.2, 8), materials.metalDark);
  pole.position.y = .48;
  group.add(pole);
  const base = mesh(new THREE.CylinderGeometry(.45, .5, .08, 8), materials.black);
  base.position.y = .06;
  group.add(base);
  group.userData = { type: 'target', id, targetData: torso.userData.target, targetGlow, baseY: 0 };
  return group;
}

export function createPlanter(materials, foliageDensity = 1) {
  const group = new THREE.Group();
  const box = mesh(new THREE.BoxGeometry(1.8, .46, .76), materials.concreteDark);
  box.position.y = .23;
  group.add(box);
  const leafMaterial = materials.militaryPaint;
  const count = Math.max(2, Math.round(5 * foliageDensity));
  for (let i = 0; i < count; i += 1) {
    const leaf = mesh(new THREE.IcosahedronGeometry(.22 + i * .018, 0), leafMaterial, true, false);
    leaf.position.set((i / Math.max(1, count - 1) - .5) * 1.35, .88 + (i % 2) * .12, (i % 2 ? .14 : -.14));
    leaf.scale.y = 1.8 + (i % 3) * .18;
    leaf.rotation.z = (i % 2 ? 1 : -1) * (.12 + i * .04);
    leaf.userData.windPhase = i * .9;
    group.add(leaf);
  }
  group.userData = { type: 'planter' };
  return group;
}

export function createPipe(materials, length = 5, vertical = false) {
  const pipe = mesh(new THREE.CylinderGeometry(.11, .11, length, 10), materials.metalDark);
  pipe.rotation.z = vertical ? 0 : Math.PI / 2;
  pipe.userData = { type: 'pipe' };
  return pipe;
}

export function createCable(materials, points) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(4, points.length * 3), .035, 5, false), materials.rubber);
  cable.castShadow = true;
  cable.userData = { type: 'cable' };
  return cable;
}

export function createDoorFrame(materials, width = 1.8, height = 2.7) {
  const group = new THREE.Group();
  const postGeometry = new THREE.BoxGeometry(.16, height, .22);
  for (const x of [-width / 2, width / 2]) { const post = mesh(postGeometry, materials.glassFrame); post.position.set(x, height / 2, 0); group.add(post); }
  const header = mesh(new THREE.BoxGeometry(width + .16, .16, .22), materials.glassFrame);
  header.position.set(0, height, 0);
  group.add(header);
  return group;
}
