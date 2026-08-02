import { AdditiveBlending, AmbientLight, BackSide, BoxGeometry, Color, ConeGeometry, CylinderGeometry, DirectionalLight, DodecahedronGeometry, DoubleSide, EdgesGeometry, Group, HemisphereLight, LineSegments, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, PointLight, ShaderMaterial, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { createBarrier, createBarrel, createCable, createCrate, createDoorFrame, createInstancedCrates, createPlanter, createPipe, createTargetDummy, createWeaponRack } from './Props.js';

export class WorldBuilder {
  constructor(scene, materials, settings = {}) {
    this.scene = scene;
    this.materials = materials;
    this.settings = { foliageDensity: 1, dynamicLights: 4, ...settings };
    this.mobileLighting = Boolean(this.settings.mobile);
    this.normalFogColor = this.mobileLighting ? 0x35615e : 0x193637;
    this.normalFogDensity = this.mobileLighting ? .0055 : .0115;
    this.root = new Group();
    this.root.name = 'RelayYard7';
    this.scene.add(this.root);
    this.collisionBoxes = [];
    this.dynamicObjects = [];
    this.targetMeshes = [];
    this.targets = [];
    this.terminals = [];
    this.extractionZone = null;
    this.lights = [];
    this.foliage = [];
    this.glowMeshes = [];
    this.hazeMeshes = [];
    this.time = 0;
    this.blackout = false;
    this.spawn = new Vector3(0, .02, 18);
  }

  build() {
    this.addLighting();
    this.addBackdrop();
    this.addGround();
    this.addBoundary();
    this.addArchitecture();
    this.addCoverAndProps();
    this.addMissionObjects();
    this.addAtmosphereDetails();
    return this;
  }

  addBox(position, size, material, options = {}) {
    const geometry = new BoxGeometry(size[0], size[1], size[2]);
    const object = new Mesh(geometry, material);
    object.position.set(position[0], position[1], position[2]);
    object.castShadow = !this.mobileLighting && (options.castShadow ?? true);
    object.receiveShadow = !this.mobileLighting && (options.receiveShadow ?? true);
    if (options.rotation) object.rotation.set(...options.rotation);
    if (options.edge) {
      const edge = new LineSegments(new EdgesGeometry(geometry, 22), this.materials.edge);
      edge.renderOrder = 2;
      object.add(edge);
    }
    this.root.add(object);
    if (options.collision !== false) this.addCollision(position, size, options.material ?? 'concrete');
    return object;
  }

  addCollision(position, size, material = 'concrete') {
    this.collisionBoxes.push({
      min: new Vector3(position[0] - size[0] / 2, position[1] - size[1] / 2, position[2] - size[2] / 2),
      max: new Vector3(position[0] + size[0] / 2, position[1] + size[1] / 2, position[2] + size[2] / 2),
      material,
    });
  }

  addLighting() {
    const mobileBoost = this.mobileLighting ? 1.55 : 1;
    const hemisphere = new HemisphereLight(0x9bbdb5, 0x111718, 1.1 * mobileBoost);
    const ambient = new AmbientLight(0x5f9284, this.mobileLighting ? .68 : .1);
    ambient.userData.baseIntensity = ambient.intensity;
    this.ambientLight = ambient;
    this.scene.add(hemisphere, ambient);
    const sun = new DirectionalLight(0xdce9df, 2.15 * (this.mobileLighting ? 1.12 : 1));
    sun.position.set(-18, 28, 12);
    sun.target.position.set(0, 0, -4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -42; sun.shadow.camera.right = 42; sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
    sun.shadow.bias = -.0005;
    this.scene.add(sun, sun.target);

    const spawnFill = new PointLight(0x62c7ae, this.mobileLighting ? 3.4 : 1.1, 19, 2);
    spawnFill.position.set(0, 4.5, 14);
    spawnFill.userData.baseIntensity = spawnFill.intensity;
    spawnFill.userData.flicker = false;
    spawnFill.userData.priority = 0;
    this.scene.add(spawnFill);
    this.lights.push(spawnFill);

    const fills = [
      { position: [-22, 4.2, -15], color: 0x5bf0c9, intensity: 2.8, distance: 11 },
      { position: [22, 5.5, -7], color: 0xffa14b, intensity: 2.4, distance: 12 },
      { position: [-3, 3.2, -3], color: 0x72a9ff, intensity: 1.5, distance: 9 },
      { position: [26, 4.2, 17], color: 0x64e1bd, intensity: 2, distance: 13 },
      { position: [-27, 6.5, 5], color: 0xff9d4e, intensity: 1.6, distance: 10 },
      { position: [4, 7.4, -14], color: 0x80f2d0, intensity: 1.8, distance: 10 },
    ];
    fills.forEach((data, index) => {
      const light = new PointLight(data.color, data.intensity, data.distance, 2);
      light.position.set(...data.position);
      light.userData.baseIntensity = data.intensity;
      light.userData.flicker = index % 2 === 0;
      light.userData.priority = index < 4 ? 0 : 1;
      this.scene.add(light);
      this.lights.push(light);
      const lamp = new Mesh(new BoxGeometry(.18, .18, .18), this.materials.cyan);
      lamp.position.copy(light.position);
      lamp.castShadow = false;
      this.root.add(lamp);
    });
  }

  addGround() {
    this.addBox([0, -.25, 0], [86, .5, 56], this.materials.wet, { material: 'wet', castShadow: false });
    const inlay = this.addBox([0, .012, 9], [36, .025, 17], this.materials.tile, { collision: false, castShadow: false, receiveShadow: true });
    inlay.material.map.repeat.set(6, 3);
    const strip = this.addBox([0, .02, -1], [1.4, .03, 32], this.materials.militaryDark, { collision: false, castShadow: false });
    strip.material.map.repeat.set(1, 8);
    for (const x of [-20, -11, 11, 20]) this.addBox([x, .03, 9], [1.3, .025, 25], this.materials.concreteDark, { collision: false, castShadow: false });
    const puddles = [[-14, 11, 4.8, 1.2, -.08], [8, 16, 3.1, .8, .12], [24, 9, 4.2, 1.05, -.04], [-2, -7, 2.8, .65, .07]];
    puddles.forEach(([x, z, width, depth, rotation]) => {
      const puddle = new Mesh(new PlaneGeometry(width, depth), this.materials.puddle);
      puddle.rotation.set(-Math.PI / 2, 0, rotation); puddle.position.set(x, .035, z);
      puddle.receiveShadow = true; this.root.add(puddle);
    });
    for (const x of [-18, -9, 9, 18]) this.addBox([x, .045, 20.8], [5.5, .018, .035], this.materials.trim, { collision: false, castShadow: false, receiveShadow: false });
    for (const z of [4.2, 8.5, 12.8, 17.1]) this.addBox([-20.4, .047, z], [.035, .018, 3.8], this.materials.warning, { collision: false, castShadow: false, receiveShadow: false });
    const drainRing = new Mesh(new TorusGeometry(.68, .045, 6, 20), this.materials.trim);
    drainRing.rotation.x = -Math.PI / 2; drainRing.position.set(7.5, .055, 7.5); drainRing.receiveShadow = true; this.root.add(drainRing);
    this.addBox([7.5, .057, 7.5], [1.05, .018, .08], this.materials.black, { collision: false, castShadow: false, receiveShadow: false });
  }

  addBackdrop() {
    const sky = new Mesh(new SphereGeometry(115, 20, 12), new ShaderMaterial({
      side: BackSide, depthWrite: false,
      uniforms: {
        top: { value: new Color(this.mobileLighting ? 0x102b34 : 0x07131c) },
        horizon: { value: new Color(this.mobileLighting ? 0x476e63 : 0x35584f) },
        sun: { value: new Color(0xffbf7a) },
      },
      vertexShader: 'varying vec3 vWorld; void main(){ vWorld=normalize((modelMatrix*vec4(position,1.0)).xyz); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 horizon; uniform vec3 sun; varying vec3 vWorld; void main(){ float h=smoothstep(-.28,.48,vWorld.y); vec3 c=mix(horizon,top,h); float glow=pow(max(0.0,dot(vWorld,normalize(vec3(-.55,.28,.55)))),18.0); gl_FragColor=vec4(c+sun*glow*.55,1.0); }',
    }));
    sky.position.y = 12; sky.frustumCulled = false; this.root.add(sky);
    const skylineMaterial = new MeshStandardMaterial({ color: this.mobileLighting ? 0x24433b : 0x102521, roughness: .9, metalness: .18 });
    const windowMaterial = new MeshStandardMaterial({ color: 0x73d7bd, emissive: 0x1b6b59, emissiveIntensity: 1.6, roughness: .38 });
    for (let i = 0; i < 28; i += 1) {
      const angle = (i / 28) * Math.PI * 2;
      const radius = 58 + (i % 4) * 4;
      const height = 9 + (i * 7) % 18;
      const building = new Mesh(new BoxGeometry(3 + (i % 3) * 1.8, height, 3.4 + (i % 2) * 2), skylineMaterial);
      building.position.set(Math.cos(angle) * radius, height / 2 - 1, Math.sin(angle) * radius); building.castShadow = false; building.receiveShadow = false; this.root.add(building);
      if (i % 2 === 0) {
        const windowBand = new Mesh(new BoxGeometry(building.geometry.parameters.width + .03, .22, .05), windowMaterial);
        windowBand.position.copy(building.position); windowBand.position.y += height * .18; windowBand.lookAt(0, windowBand.position.y, 0); this.root.add(windowBand);
      }
    }
    const coneGeometry = new ConeGeometry(3.8, 17, 18, 1, true);
    const hazeMaterial = new MeshBasicMaterial({ color: 0x80f2d0, transparent: true, opacity: this.mobileLighting ? .026 : .045, depthWrite: false, side: DoubleSide, blending: AdditiveBlending });
    [[-22, 7, -15], [22, 8, -7], [4, 8, -14]].forEach((position, index) => {
      const haze = new Mesh(coneGeometry, hazeMaterial); haze.position.set(...position); haze.rotation.x = Math.PI; haze.userData.phase = index * 2.4; this.root.add(haze); this.hazeMeshes.push(haze);
    });
  }

  addBoundary() {
    this.addBox([-42.5, 4, 0], [1, 8, 56], this.materials.concrete, { material: 'concrete', edge: true });
    this.addBox([42.5, 4, 0], [1, 8, 56], this.materials.concrete, { material: 'concrete', edge: true });
    this.addBox([0, 4, -27.5], [86, 8, 1], this.materials.concrete, { material: 'concrete', edge: true });
    this.addBox([0, 4, 27.5], [86, 8, 1], this.materials.concrete, { material: 'concrete', edge: true });
    for (const x of [-38, -29, 29, 38]) {
      const post = this.addBox([x, 6, -26.8], [.42, 4.5, .42], this.materials.metalDark, { collision: false });
      post.rotation.z = .02;
    }
  }

  addArchitecture() {
    // Command block on the north side: low cover, a service corridor, and an upper sight line.
    this.addBox([-30, 2.8, -18], [17, 5.6, .7], this.materials.concrete, { material: 'concrete', edge: true });
    this.addBox([-10, 2.8, -18], [3.4, 5.6, .7], this.materials.concrete, { material: 'concrete', edge: true });
    this.addBox([-39, 2.8, -12], [.7, 5.6, 12], this.materials.concrete, { material: 'concrete', edge: true });
    this.addBox([-21, 2.8, -12], [.7, 5.6, 12], this.materials.concrete, { material: 'concrete', edge: true });
    this.addBox([-30, 6.0, -13.5], [18, .4, 9], this.materials.tile, { material: 'concrete' });
    this.addBox([-30, 8.2, -18], [18, .55, .7], this.materials.militaryDark, { material: 'concrete' });
    this.addBox([-39, 8.2, -13.5], [.7, .55, 9], this.materials.militaryDark, { material: 'concrete' });
    this.addBox([-21, 8.2, -13.5], [.7, .55, 9], this.materials.militaryDark, { material: 'concrete' });
    this.addBox([-30, 5.1, -8.6], [18, 2.3, .3], this.materials.metalDark, { collision: false });
    this.addBox([-30, 5.1, -18.0], [18, 2.3, .3], this.materials.metalDark, { collision: false });
    const door = createDoorFrame(this.materials, 2.2, 3.4);
    door.position.set(-30, 0, -8.5);
    this.root.add(door);
    const innerDoor = createDoorFrame(this.materials, 1.8, 2.8);
    innerDoor.position.set(-21, 0, -13.5);
    innerDoor.rotation.y = Math.PI / 2;
    this.root.add(innerDoor);
    this.addWindow([-30, 3.3, -18.38], [4.2, 2.2], 0);
    this.addWindow([-24.2, 3.3, -18.38], [3.2, 2.2], 0);

    // Service hall on the east side, with cover gaps and a raised catwalk.
    this.addBox([27, 2.5, -15], [1, 5, 20], this.materials.concrete, { material: 'concrete', edge: true });
    this.addBox([35, 2.5, -15], [1, 5, 20], this.materials.concrete, { material: 'concrete', edge: true });
    this.addBox([31, 2.5, -25], [8, 5, 1], this.materials.concrete, { material: 'concrete', edge: true });
    this.addBox([31, 4.8, -15], [8, .4, 20], this.materials.tile, { material: 'concrete' });
    for (const z of [-22, -15, -8]) {
      const rail = this.addBox([31, 6, z], [8, .18, .18], this.materials.metalDark, { collision: false });
      this.addBox([27.2, 5.4, z], [.18, 1.3, .18], this.materials.metalDark, { collision: false });
      this.addBox([34.8, 5.4, z], [.18, 1.3, .18], this.materials.metalDark, { collision: false });
      rail.material = this.materials.metal;
    }
    this.addBox([31, 0.9, -5], [8, 1.8, .5], this.materials.concreteDark, { material: 'concrete' });
    this.addWindow([35.45, 2.8, -15], [7, 2], Math.PI / 2);

    // Stairs to the command block and a second short ramp route.
    for (let i = 0; i < 10; i += 1) {
      const height = .32 * (i + 1);
      this.addBox([-7.5, height / 2, -8.5 - i * .38], [3.2, height, .55], this.materials.concreteDark, { material: 'concrete' });
    }
    for (let i = 0; i < 9; i += 1) {
      const height = .28 * (i + 1);
      this.addBox([11.5, height / 2, -1.5 - i * .45], [3.2, height, .62], this.materials.concreteDark, { material: 'concrete' });
    }
    const ramp = this.addBox([17, 1.1, 3], [5, .28, 13], this.materials.militaryDark, { collision: false, rotation: [Math.atan2(2.2, 13), 0, 0] });
    ramp.material.map.repeat.set(2, 5);
    this.addBox([17, .95, 3], [5.2, 1.9, 11], this.materials.concreteDark, { material: 'concrete', collision: false });
    this.addBox([17, 1, -2.2], [5.3, 2, 1.4], this.materials.concreteDark, { material: 'concrete' });
    this.addArchitectureDetails();
  }

  addArchitectureDetails() {
    const wallRibs = [-36.5, -33.2, -29.8, -26.4, -23.2];
    wallRibs.forEach((x, index) => {
      this.addBox([x, 3.1, -18.43], [.12, 5.2, .08], index % 2 ? this.materials.trim : this.materials.metalDark, { collision: false, castShadow: false, edge: true });
      this.addBox([x, 1.0, -18.47], [.62, .06, .06], this.materials.warning, { collision: false, castShadow: false, receiveShadow: false });
    });
    for (const y of [1.15, 2.55, 3.95, 5.35]) this.addBox([-39.42, y, -12], [.06, .04, 10.5], this.materials.trim, { collision: false, castShadow: false, receiveShadow: false });
    for (const z of [-23, -19, -15, -11, -7]) {
      this.addBox([27.5, 3.15, z], [.08, 4.9, .14], this.materials.trim, { collision: false, castShadow: false, edge: true });
      this.addBox([34.5, 3.15, z], [.08, 4.9, .14], this.materials.metalDark, { collision: false, castShadow: false });
    }
    for (const z of [-23, -19, -15, -11, -7]) this.addBox([31, 7.05, z], [7.5, .12, .12], this.materials.trim, { collision: false, castShadow: false, receiveShadow: false });
    for (const x of [-6, -2, 2, 6]) this.addBox([x, .065, -2.8], [.07, .02, 5.8], this.materials.trim, { collision: false, castShadow: false, receiveShadow: false });
    this.addRelayMast();
  }

  addRelayMast() {
    const mast = new Group();
    mast.position.set(0, 0, -20.5);
    const postGeometry = new CylinderGeometry(.13, .18, 8.2, 8);
    for (const [x, z] of [[-.95, -.65], [.95, -.65], [-.95, .65], [.95, .65]]) {
      const post = new Mesh(postGeometry, this.materials.metalDark);
      post.position.set(x, 4.1, z); post.castShadow = true; mast.add(post);
    }
    const braceGeometry = new BoxGeometry(2.55, .07, .07);
    for (const y of [1.4, 3.1, 4.8, 6.5]) {
      const brace = new Mesh(braceGeometry, this.materials.trim);
      brace.position.y = y; brace.rotation.z = Math.PI / 2; mast.add(brace);
      const cross = brace.clone(); cross.rotation.set(0, Math.PI / 2, 0); cross.scale.z = .8; mast.add(cross);
    }
    const platform = new Mesh(new CylinderGeometry(1.65, 1.65, .12, 16), this.materials.metalDark);
    platform.position.y = 5.85; platform.castShadow = true; mast.add(platform);
    const ring = new Mesh(new TorusGeometry(1.46, .055, 8, 32), this.materials.trim);
    ring.position.y = 5.94; mast.add(ring);
    const dish = new Mesh(new SphereGeometry(.86, 16, 8, 0, Math.PI * 2, 0, Math.PI * .52), this.materials.panel);
    dish.position.set(0, 6.7, 0); dish.rotation.x = -.42; mast.add(dish);
    const antenna = new Mesh(new CylinderGeometry(.045, .08, 2.3, 8), this.materials.trim);
    antenna.position.y = 8.2; mast.add(antenna);
    const beacon = new Mesh(new SphereGeometry(.13, 10, 8), this.materials.amberHot);
    beacon.position.y = 9.35; mast.add(beacon); this.glowMeshes.push(beacon);
    const screen = new Mesh(new BoxGeometry(1.1, .38, .035), this.materials.screen);
    screen.position.set(0, 2.5, -.72); mast.add(screen); this.glowMeshes.push(screen);
    mast.traverse((child) => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
    this.root.add(mast);
    const mastLight = new PointLight(0xff9652, 1.9, 8, 2);
    mastLight.position.set(0, 8.7, -20.5); mastLight.userData.baseIntensity = 1.9; mastLight.userData.flicker = true; mastLight.userData.priority = 1;
    this.scene.add(mastLight); this.lights.push(mastLight);
  }

  addWindow(position, size, rotationY = 0) {
    const frame = new Group();
    const glass = new Mesh(new PlaneGeometry(size[0], size[1]), this.materials.glass);
    glass.position.set(0, 0, .01);
    frame.add(glass);
    const vertical = new BoxGeometry(.1, size[1] + .25, .15);
    for (const x of [-size[0] / 2, size[0] / 2]) { const post = new Mesh(vertical, this.materials.glassFrame); post.position.set(x, 0, 0); frame.add(post); }
    const horizontal = new Mesh(new BoxGeometry(size[0] + .2, .1, .15), this.materials.glassFrame);
    horizontal.position.y = size[1] / 2;
    frame.add(horizontal);
    const crossbar = new Mesh(new BoxGeometry(.08, size[1], .12), this.materials.glassFrame);
    frame.add(crossbar);
    frame.position.set(...position);
    frame.rotation.y = rotationY;
    frame.traverse((child) => { if (child.isMesh) { child.castShadow = false; child.receiveShadow = true; } });
    this.root.add(frame);
  }

  addCoverAndProps() {
    const barriers = [[-15, 0, 7, 0], [-4, 0, 4, .08], [6, 0, 10, -.1], [22, 0, 12, .12], [3, 0, 20, 0]];
    barriers.forEach(([x, y, z, rotation]) => { const barrier = createBarrier(this.materials, 3.2); barrier.position.set(x, y, z); barrier.rotation.y = rotation; this.root.add(barrier); this.addCollision([x, .36, z], [3.2, .72, .42], 'concrete'); });

    const cratePlacements = [
      { x: -12, z: 13, scale: 1 }, { x: -10.6, z: 13.8, scale: .8 }, { x: -8.9, z: 13.1, scale: .9 },
      { x: 15.5, z: 16, scale: 1.1 }, { x: 17.1, z: 15.4, scale: .8 }, { x: 28, z: 8, scale: .85 },
    ];
    const instanced = createInstancedCrates(this.materials, cratePlacements.length, cratePlacements);
    this.root.add(instanced);
    cratePlacements.forEach((item) => this.addCollision([item.x, (item.scale ?? 1) * .45, item.z], [1.15 * (item.scale ?? 1), .9 * (item.scale ?? 1), 1.15 * (item.scale ?? 1)], 'wood'));
    for (const [x, z, scale] of [[-25, 5, 1], [25, 19, 1], [32, 4, .9]]) this.addDynamic(createCrate(this.materials, scale), [x, 0, z]);
    for (const [x, z] of [[-18, 20], [20, -20], [35, 15]]) this.addDynamic(createBarrel(this.materials), [x, 0, z]);

    const rack = createWeaponRack(this.materials); rack.position.set(-37.8, 0, -13); rack.rotation.y = Math.PI / 2; this.root.add(rack);
    const rack2 = createWeaponRack(this.materials); rack2.position.set(34.4, 0, -21); rack2.rotation.y = -Math.PI / 2; this.root.add(rack2);
    const targetSpots = [[-27, 0, -3.6], [-15, 0, -4.6], [7, 0, -13], [31, 4.9, -15], [23, 0, 21]];
    targetSpots.forEach((position, index) => {
      const target = createTargetDummy(this.materials, index + 1);
      target.position.set(...position);
      target.userData.spawnPosition = target.position.clone();
      if (index === 1 || index === 3) target.userData.motion = { origin: target.position.x, range: index === 1 ? 1.7 : 2.4, speed: index === 1 ? .8 : .55, phase: index * 1.7 };
      this.root.add(target);
      this.targets.push(target);
      target.traverse((child) => { if (child.isMesh && child.userData.target) this.targetMeshes.push(child); });
    });

    const planterSpots = [[-37, 0, 21], [-32, 0, 21], [38, 0, -2], [38, 0, 4]];
    planterSpots.forEach((position) => { const planter = createPlanter(this.materials, this.settings.foliageDensity); planter.position.set(...position); this.root.add(planter); planter.traverse((child) => { if (child.userData.windPhase !== undefined) this.foliage.push(child); }); });
  }

  addDynamic(object, position) {
    object.position.set(...position);
    this.root.add(object);
    this.dynamicObjects.push(object);
    return object;
  }

  addMissionObjects() {
    const terminalSpots = [
      { id: 'A', label: 'RELAY A', position: [-19, 0, 16] },
      { id: 'B', label: 'RELAY B', position: [0, 0, -10] },
      { id: 'C', label: 'RELAY C', position: [20, 0, 15] },
    ];

    terminalSpots.forEach((data) => {
      const terminal = new Group();
      terminal.name = 'Terminal_' + data.id;
      const body = new Mesh(new BoxGeometry(.85, .72, .58), this.materials.panel);
      body.position.y = .36;
      body.castShadow = true;
      body.receiveShadow = true;
      const cap = new Mesh(new BoxGeometry(.62, .08, .46), this.materials.trim);
      cap.position.y = .76;
      cap.castShadow = true;
      const screenMaterial = this.materials.screen.clone();
      const screen = new Mesh(new BoxGeometry(.45, .27, .04), screenMaterial);
      screen.position.set(0, .78, -.31);
      const ringMaterial = this.materials.cyanHot.clone();
      const ring = new Mesh(new TorusGeometry(.44, .025, 5, 24), ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = .04;
      terminal.add(body, cap, screen, ring);
      terminal.position.set(...data.position);
      this.root.add(terminal);
      const record = {
        ...data,
        position: new Vector3(...data.position),
        object: terminal,
        screen,
        ring,
        activated: false,
      };
      terminal.userData.missionTerminal = record;
      this.terminals.push(record);
    });

    const extraction = new Group();
    extraction.name = 'ExtractionZone';
    const extractionMaterial = this.materials.cyanHot.clone();
    const extractionRing = new Mesh(new TorusGeometry(2.45, .055, 8, 36), extractionMaterial);
    extractionRing.rotation.x = -Math.PI / 2;
    extractionRing.position.y = .045;
    const extractionCore = new Mesh(new CylinderGeometry(.18, .18, .8, 8), this.materials.screen.clone());
    extractionCore.position.y = .4;
    extraction.add(extractionRing, extractionCore);
    extraction.position.set(0, 0, 20.5);
    this.root.add(extraction);
    this.extractionZone = {
      position: extraction.position.clone(),
      radius: 2.8,
      object: extraction,
      ring: extractionRing,
    };
  }

  addAtmosphereDetails() {
    this.addBox([0, 8.15, -3], [38, .22, .28], this.materials.metalDark, { collision: false, castShadow: true, edge: true });
    this.addBox([0, 8.15, 7], [38, .18, .22], this.materials.trim, { collision: false, castShadow: false, receiveShadow: false });
    for (const x of [-17, -8.5, 0, 8.5, 17]) {
      this.addBox([x, 7.45, -3], [.12, 1.45, .12], this.materials.metalDark, { collision: false, castShadow: false });
      const fixture = this.addBox([x, 7.18, -3], [1.15, .055, .18], this.materials.cyanHot, { collision: false, castShadow: false, receiveShadow: false });
      this.glowMeshes.push(fixture);
    }
    const pipes = [
      { position: [-38.4, 3.3, -5], length: 11, vertical: true },
      { position: [-20.5, 6.9, -17.4], length: 16, vertical: false },
      { position: [26.3, 3.2, -23], length: 12, vertical: false },
      { position: [39, 4.5, 10], length: 9, vertical: true },
    ];
    pipes.forEach((data) => { const pipe = createPipe(this.materials, data.length, data.vertical); pipe.position.set(...data.position); this.root.add(pipe); });
    const cable = createCable(this.materials, [[-39, 7, 8], [-25, 8.8, 11], [-8, 7.6, 6], [5, 8.8, 11], [23, 7, 7]]);
    this.root.add(cable);
    const cable2 = createCable(this.materials, [[22, 6.4, -24], [27, 7.6, -16], [34, 6.2, -8]]);
    this.root.add(cable2);
    for (const [x, z] of [[-4, -22], [10, -22], [21, -22], [-1, 26], [15, 26]]) {
      const lamp = this.addBox([x, 7.2, z], [1.4, .08, .25], this.materials.cyan, { collision: false, castShadow: false });
      const point = new PointLight(0x7df3ca, 1.6, 8);
      point.position.set(x, 6.9, z); point.userData.baseIntensity = 1.6; point.userData.flicker = true; point.userData.priority = 2;
      this.scene.add(point); this.lights.push(point);
      lamp.material.emissiveIntensity = 2;
      this.glowMeshes.push(lamp);
    }
    for (const [x, z, color, label] of [[-35, -17, this.materials.cyanHot, '07'], [38, 13, this.materials.amberHot, 'R7'], [1, -25.8, this.materials.cyanHot, 'OPS']]) {
      const sign = new Group();
      const panel = new Mesh(new BoxGeometry(label === 'OPS' ? 2.5 : 1.35, .72, .08), this.materials.black);
      const glow = new Mesh(new PlaneGeometry(label === 'OPS' ? 2.1 : .95, .32), color);
      glow.position.z = .051; sign.add(panel, glow); sign.position.set(x, 3.3, z); if (z < -25) sign.rotation.x = -.1; this.root.add(sign); this.glowMeshes.push(glow);
    }
    const debrisGeometry = new DodecahedronGeometry(.12, 0);
    for (let i = 0; i < 32; i += 1) {
      const debris = new Mesh(debrisGeometry, i % 2 ? this.materials.concreteDark : this.materials.metalDark);
      debris.position.set(((i * 17) % 70) - 35, .12 + (i % 4) * .08, ((i * 23) % 42) - 20);
      debris.rotation.set(i * .4, i * .7, i * .2);
      debris.scale.setScalar(.5 + (i % 4) * .18);
      debris.castShadow = true; debris.receiveShadow = true; this.root.add(debris);
    }
  }

  setBlackout(active) {
    this.blackout = active;
    if (this.scene.fog) {
      this.scene.fog.color.set(active ? 0x0d1019 : this.normalFogColor);
      this.scene.fog.density = active ? .018 : this.normalFogDensity;
    }
    if (this.ambientLight) {
      this.ambientLight.intensity = this.ambientLight.userData.baseIntensity * (active ? .46 : 1);
    }
    this.terminals.forEach((terminal) => {
      if (!terminal.activated) terminal.ring.material.emissiveIntensity = active ? 1.1 : 2.6;
    });
  }

  setGraphics(settings) {
    this.settings = { ...this.settings, ...settings };
    this.lights.forEach((light, index) => { light.visible = index < (this.settings.dynamicLights ?? 4); });
    this.foliage.forEach((leaf, index) => { leaf.visible = index < Math.round(this.foliage.length * (this.settings.foliageDensity ?? 1)); });
  }

  update(delta) {
    this.time += delta;
    for (let i = 0; i < this.lights.length; i += 1) {
      const light = this.lights[i];
      if (!light.visible) continue;
      light.intensity = light.userData.baseIntensity * (this.blackout ? .26 : 1) * (light.userData.flicker ? .92 + Math.sin(this.time * 23 + i * 4.1) * .06 + Math.sin(this.time * 61 + i) * .025 : 1);
    }
    for (let i = 0; i < this.foliage.length; i += 1) {
      const leaf = this.foliage[i];
      leaf.rotation.x = Math.sin(this.time * .75 + leaf.userData.windPhase) * .035;
      leaf.rotation.z += Math.sin(this.time * .5 + leaf.userData.windPhase) * delta * .01;
    }
    for (let i = 0; i < this.glowMeshes.length; i += 1) {
      const mesh = this.glowMeshes[i];
      mesh.material.emissiveIntensity = 1.65 + Math.sin(this.time * 3.2 + i) * .28;
    }
    for (let i = 0; i < this.hazeMeshes.length; i += 1) {
      const haze = this.hazeMeshes[i];
      haze.rotation.z = Math.sin(this.time * .28 + haze.userData.phase) * .07;
      haze.material.opacity = .035 + Math.sin(this.time * .8 + haze.userData.phase) * .008;
    }
    for (let i = 0; i < this.targets.length; i += 1) {
      const target = this.targets[i];
      const targetData = target.userData.targetData;
      if (target.userData.motion && targetData.health > 0 && target.userData.downTimer <= 0) {
        target.position.x = target.userData.motion.origin + Math.sin(this.time * target.userData.motion.speed + target.userData.motion.phase) * target.userData.motion.range;
      }
      if (target.userData.hitTimer > 0) { target.userData.hitTimer -= delta; target.rotation.z *= .9; }
      if (target.userData.downTimer > 0) {
        target.userData.downTimer -= delta;
        if (target.userData.downTimer <= 0) target.rotation.set(0, 0, 0);
      }
      if (target.userData.targetGlow) {
        target.userData.targetGlow.visible = targetData.health > 0;
        target.userData.targetGlow.material.emissiveIntensity = 2.1 + Math.sin(this.time * 4.4 + i) * .35;
      }
    }
  }

  resetTargets() {
    this.targets.forEach((target) => {
      target.userData.targetData.health = 100;
      target.rotation.set(0, 0, 0);
      if (target.userData.spawnPosition) target.position.copy(target.userData.spawnPosition);
      target.userData.hitTimer = 0;
      target.userData.downTimer = 0;
    });
  }

  dispose() {
    this.root.traverse((object) => { object.geometry?.dispose?.(); });
  }
}
