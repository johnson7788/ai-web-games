import * as THREE from 'three';
import { CONFIG } from '../../config/game.config.js';
import { MOVES } from '../../config/moves.js';

const gradient = new THREE.DataTexture(new Uint8Array([96, 176, 255]), 3, 1, THREE.RedFormat);
gradient.minFilter = THREE.NearestFilter;
gradient.magFilter = THREE.NearestFilter;
gradient.needsUpdate = true;

const geometry = {
  sphere: new THREE.SphereGeometry(1, 24, 18),
  eye: new THREE.SphereGeometry(1, 16, 12),
  circle: new THREE.CircleGeometry(1, 20),
  cone: new THREE.ConeGeometry(1, 1, 16),
  curl: new THREE.TorusGeometry(0.23, 0.075, 8, 20, Math.PI * 1.65),
  scarf: new THREE.TorusGeometry(0.31, 0.05, 8, 24),
};
const materialCache = new Map();
const capsuleCache = new Map();
const outlineMaterial = new THREE.MeshBasicMaterial({ color: '#2B2440', side: THREE.BackSide, toneMapped: false });

function toon(color) {
  if (!materialCache.has(color)) {
    materialCache.set(color, new THREE.MeshToonMaterial({ color, gradientMap: gradient }));
  }
  return materialCache.get(color);
}

function capsule(radius, length) {
  const key = `${radius}:${length}`;
  if (!capsuleCache.has(key)) capsuleCache.set(key, new THREE.CapsuleGeometry(radius, length, 5, 10));
  return capsuleCache.get(key);
}

function addMesh(parent, geo, material, position, scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function mergeMeshes(meshes) {
  const positions = [];
  const normals = [];
  const colors = [];
  for (const mesh of meshes) {
    mesh.updateMatrix();
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrix);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const color = mesh.material.color ?? new THREE.Color('#FFFFFF');
    for (let index = 0; index < position.count; index++) {
      positions.push(position.getX(index), position.getY(index), position.getZ(index));
      normals.push(normal.getX(index), normal.getY(index), normal.getZ(index));
      colors.push(color.r, color.g, color.b);
    }
    geometry.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function batchStaticMeshes(parent, preserve = null) {
  for (const child of [...parent.children]) {
    if (child.isGroup && child !== preserve) batchStaticMeshes(child, preserve);
  }
  if (parent === preserve) return;
  const buckets = new Map();
  for (const mesh of parent.children) {
    if (!mesh.isMesh || Array.isArray(mesh.material) || mesh.material.transparent || mesh.material.map) continue;
    const material = mesh.material;
    if (!material.isMeshToonMaterial && !material.isMeshBasicMaterial) continue;
    const kind = material.isMeshToonMaterial ? 'toon' : 'basic';
    const key = `${kind}:${material.side}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(mesh);
  }
  for (const [key, meshes] of buckets) {
    if (meshes.length < 2) continue;
    const source = meshes[0].material;
    const material = source.isMeshToonMaterial
      ? new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient, side: source.side })
      : new THREE.MeshBasicMaterial({ vertexColors: true, side: source.side, toneMapped: source.toneMapped });
    const merged = new THREE.Mesh(mergeMeshes(meshes), material);
    merged.castShadow = meshes.some((mesh) => mesh.castShadow);
    merged.receiveShadow = meshes.some((mesh) => mesh.receiveShadow);
    merged.userData.animalOutline = meshes.every((mesh) => mesh.userData.animalOutline);
    for (const mesh of meshes) parent.remove(mesh);
    parent.add(merged);
  }
}

function outlinedSphere(parent, material, position, scale) {
  const group = new THREE.Group();
  group.position.set(...position);
  parent.add(group);
  const mesh = addMesh(group, geometry.sphere, material, [0, 0, 0], scale);
  const outline = addMesh(group, geometry.sphere, outlineMaterial, [0, 0, 0], scale.map((value) => value * 1.035));
  outline.castShadow = false;
  outline.receiveShadow = false;
  outline.userData.animalOutline = true;
  return { group, mesh, baseScale: new THREE.Vector3(...scale) };
}

function makeEye(parent, colors, position, size = 1) {
  const group = new THREE.Group();
  group.position.set(...position);
  parent.add(group);
  const dark = toon(colors.nose);
  const normal = addMesh(group, geometry.eye, dark, [0, 0, 0], [0.078 * size, 0.112 * size, 0.052 * size]);
  const highlight = new THREE.MeshBasicMaterial({ color: '#FFF8EA', toneMapped: false });
  const shine = addMesh(group, geometry.eye, highlight, [-0.022 * size, 0.035 * size, 0.047 * size], [0.023 * size, 0.029 * size, 0.018 * size]);
  const cross = new THREE.Group();
  for (const angle of [-Math.PI / 4, Math.PI / 4]) {
    const bar = addMesh(cross, capsule(0.014 * size, 0.13 * size), highlight, [0, 0, 0.065 * size]);
    bar.rotation.z = angle;
  }
  cross.visible = false;
  group.add(cross);
  group.userData.normal = [normal, shine];
  group.userData.cross = cross;
  return group;
}

function addCheeks(parent, colors, y = -0.09, z = 0.45) {
  const material = new THREE.MeshBasicMaterial({ color: colors.cheek, transparent: true, opacity: 0.82, side: THREE.DoubleSide, toneMapped: false });
  for (const side of [-1, 1]) {
    const cheek = addMesh(parent, geometry.circle, material, [side * 0.32, y, z], [0.073, 0.047, 1]);
    cheek.rotation.y = side * 0.28;
    cheek.castShadow = false;
  }
}

function addEars(head, character) {
  const { colors, build, id } = character;
  const fur = toon(colors.fur);
  const inner = toon(colors.fur2);
  const ears = [];
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    let baseRotation = 0;
    if (build.ear === 'pointy') {
      ear.position.set(side * 0.29, 0.39, -0.01);
      baseRotation = -side * 0.2;
      addMesh(ear, geometry.cone, fur, [0, 0, 0], [0.19, id === 'fox' ? 0.55 : 0.45, 0.16]);
      addMesh(ear, geometry.cone, inner, [0, 0, 0.115], [0.10, id === 'fox' ? 0.36 : 0.28, 0.055]);
    } else if (build.ear === 'round') {
      ear.position.set(side * 0.35, 0.32, -0.02);
      addMesh(ear, geometry.sphere, toon(id === 'panda' ? colors.fur2 : colors.fur), [0, 0, 0], [0.18, 0.18, 0.13]);
      addMesh(ear, geometry.sphere, inner, [0, 0, 0.105], [0.10, 0.10, 0.055]);
    } else if (build.ear === 'floppy') {
      const rabbit = id === 'rabbit';
      ear.position.set(side * (rabbit ? 0.24 : 0.39), rabbit ? 0.58 : 0.18, -0.02);
      baseRotation = side * (rabbit ? 0.12 : 0.32);
      addMesh(ear, geometry.sphere, fur, [0, 0, 0], [rabbit ? 0.15 : 0.16, rabbit ? 0.50 : 0.31, 0.12]);
      addMesh(ear, geometry.sphere, inner, [0, rabbit ? 0 : -0.01, 0.115], [rabbit ? 0.075 : 0.085, rabbit ? 0.39 : 0.22, 0.035]);
    } else if (id === 'duck') {
      ear.position.set(side * 0.47, 0.02, -0.03);
      baseRotation = side * 0.35;
      addMesh(ear, geometry.sphere, inner, [0, 0, 0], [0.13, 0.07, 0.10]);
    } else continue;
    ear.rotation.z = baseRotation;
    ear.userData.baseRotation = baseRotation;
    head.add(ear);
    ears.push(ear);
  }
  return ears;
}

function addFace(head, character) {
  const { id, colors, build } = character;
  const eyes = [];
  if (id === 'panda') {
    for (const side of [-1, 1]) {
      const patchScale = build.eyePatch ?? 1;
      const patch = addMesh(head, geometry.sphere, toon(colors.fur2), [side * 0.18, 0.08, 0.423], [0.145 * patchScale, 0.17 * patchScale, 0.045]);
      patch.rotation.z = side * 0.22;
    }
  }
  if (id === 'cat') {
    addMesh(head, geometry.sphere, toon(colors.accent), [-0.25, 0.31, 0.30], [0.18, 0.12, 0.055]);
    addMesh(head, geometry.sphere, toon('#F2C28F'), [0.27, 0.26, 0.31], [0.15, 0.17, 0.05]);
  }
  if (id === 'frog') {
    for (const side of [-1, 1]) {
      addMesh(head, geometry.sphere, toon(colors.fur), [side * 0.25, 0.34, 0.10], [0.21, 0.21, 0.18]);
      eyes.push(makeEye(head, colors, [side * 0.25, 0.37, 0.27], 1.12));
    }
    const smile = addMesh(head, new THREE.TorusGeometry(0.17, 0.018, 6, 18, Math.PI), toon(colors.nose), [0, -0.08, 0.47], [1, 0.65, 1]);
    smile.rotation.z = Math.PI;
    addCheeks(head, colors, -0.13, 0.42);
    return eyes;
  }
  if (id === 'duck') {
    eyes.push(makeEye(head, colors, [-0.18, 0.10, 0.45]), makeEye(head, colors, [0.18, 0.10, 0.45]));
    addMesh(head, geometry.sphere, toon(colors.nose), [0, -0.09, 0.50], [0.25, 0.085, 0.20]);
    addMesh(head, geometry.sphere, toon(colors.beak ?? colors.nose), [0, -0.15, 0.48], [0.21, 0.045, 0.16]);
    addCheeks(head, colors);
    return eyes;
  }

  eyes.push(makeEye(head, colors, [-0.18, 0.09, 0.45]), makeEye(head, colors, [0.18, 0.09, 0.45]));
  if (build.snout) {
    addMesh(head, geometry.sphere, toon(colors.fur2), [0, -0.12, 0.43], [id === 'fox' ? 0.22 : 0.26, 0.16, id === 'fox' ? 0.24 : 0.18]);
    addMesh(head, geometry.sphere, toon(colors.nose), [0, -0.055, id === 'fox' ? 0.65 : 0.59], [0.072, 0.057, 0.055]);
  }
  if (build.brow) {
    for (const side of [-1, 1]) {
      const brow = addMesh(head, capsule(0.018, 0.10), toon(colors.nose), [side * 0.18, 0.245, 0.44], [1, 1, 1]);
      brow.rotation.z = Math.PI / 2 + side * 0.18;
    }
  }
  addCheeks(head, colors);
  return eyes;
}

function addTail(body, character) {
  const { build, colors, id } = character;
  const tail = new THREE.Group();
  tail.position.set(0, 0.58, -0.32);
  body.add(tail);
  if (build.tail === 'curl') {
    const mesh = addMesh(tail, geometry.curl, toon(colors.fur), [0.08, 0.13, -0.08], [1, 1, 1]);
    mesh.rotation.z = -0.5;
  } else if (build.tail === 'thin') {
    const count = id === 'fox' ? 4 : 5;
    for (let i = 0; i < count; i++) {
      const ratio = i / (count - 1);
      const size = id === 'fox' ? 0.16 + Math.sin(ratio * Math.PI) * 0.09 : 0.075;
      const material = toon(id === 'fox' && i === count - 1 ? colors.fur2 : colors.fur);
      addMesh(tail, geometry.sphere, material, [0.12 + ratio * 0.27, ratio * 0.48, -ratio * 0.30], [size, size * 1.15, size]);
    }
  } else if (id !== 'frog') {
    addMesh(tail, geometry.sphere, toon(colors.fur2), [0, 0.02, -0.10], [0.16, 0.16, 0.16]);
  }
  return tail;
}

function addNeckwear(body, character) {
  const { id, colors } = character;
  if (!['shiba', 'bear', 'duck', 'cat'].includes(id)) return;
  const scarf = addMesh(body, geometry.scarf, toon(colors.accent), [0, 0.91, 0.02], [1, 1, 1]);
  scarf.rotation.x = Math.PI / 2;
  if (id === 'cat') {
    addMesh(body, geometry.sphere, toon('#FFD166'), [0, 0.82, 0.35], [0.075, 0.075, 0.055]);
    return;
  }
  const flag = new THREE.BufferGeometry();
  flag.setAttribute('position', new THREE.Float32BufferAttribute([-0.13, 0.91, 0.35, 0.13, 0.91, 0.35, 0.03, 0.66, 0.40], 3));
  flag.computeVertexNormals();
  addMesh(body, flag, new THREE.MeshToonMaterial({ color: colors.accent, gradientMap: gradient, side: THREE.DoubleSide }), [0, 0, 0]);
}

export function createAnimal(character, scale = 1, teamColor = null) {
  const group = new THREE.Group();
  group.scale.setScalar(scale);
  const model = new THREE.Group();
  group.add(model);
  const body = new THREE.Group();
  model.add(body);
  const { colors, build } = character;

  const torso = outlinedSphere(body, toon(colors.fur), [0, 0.61, 0], [build.body, build.body * 0.92, build.body * 0.84]);
  outlinedSphere(body, toon(colors.belly), [0, 0.57, build.body * 0.70], [build.body * 0.61, build.body * 0.66, 0.075]);
  if (teamColor) {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(build.body * 0.89, 0.045, 8, 28),
      new THREE.MeshBasicMaterial({ color: teamColor, toneMapped: false }),
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.62;
    body.add(band);
  }

  const head = new THREE.Group();
  head.position.set(0, 1.20, 0.06);
  model.add(head);
  outlinedSphere(head, toon(colors.fur), [0, 0, 0], [build.head, build.head * 0.96, build.head * 0.94]);
  const ears = addEars(head, character);
  const eyes = addFace(head, character);
  addNeckwear(body, character);
  const tail = addTail(body, character);

  const arms = [];
  const legs = [];
  const fists = [];
  const fistGlows = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * build.body * 0.90, 0.78, 0.02);
    body.add(arm);
    addMesh(arm, capsule(0.10, 0.20), toon(idColor(character, 'arm')), [0, -0.17, 0], [1, 1, 1]);
    const fist = new THREE.Group();
    fist.position.set(0, -0.35, 0.025);
    arm.add(fist);
    addMesh(fist, geometry.sphere, toon(colors.fur2), [0, 0, 0], [0.115, 0.10, 0.12]);
    const glow = addMesh(fist, geometry.sphere, new THREE.MeshBasicMaterial({ color: '#FFD166', transparent: true, opacity: 0.38, depthWrite: false, toneMapped: false }), [0, 0, 0], [0.17, 0.15, 0.18]);
    glow.visible = false;
    fists.push(fist);
    fistGlows.push(glow);
    arms.push(arm);

    const leg = new THREE.Group();
    leg.position.set(side * build.body * 0.43, 0.34, 0);
    body.add(leg);
    addMesh(leg, capsule(0.105, 0.12), toon(idColor(character, 'leg')), [0, -0.12, 0]);
    addMesh(leg, geometry.sphere, toon(colors.fur2), [0, -0.27, 0.075], [0.14, 0.085, 0.19]);
    legs.push(leg);
  }

  const itemAnchor = new THREE.Group();
  itemAnchor.position.set(0, -0.38, 0.20);
  arms[1].add(itemAnchor);

  batchStaticMeshes(model, torso.group);
  group.updateMatrixWorld(true);
  const labelY = new THREE.Box3().setFromObject(model).max.y;
  const flashMaterial = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.88, depthWrite: false, toneMapped: false });
  const flashMeshes = [];
  const flashTargets = [];
  model.traverse((object) => {
    if (object.isMesh && object.material.isMeshToonMaterial && !object.material.transparent) flashTargets.push(object);
  });
  for (const target of flashTargets) {
    const shell = new THREE.Mesh(target.geometry, flashMaterial);
    shell.scale.setScalar(1.015);
    shell.visible = false;
    shell.castShadow = false;
    target.add(shell);
    flashMeshes.push(shell);
  }

  const ghosts = [];
  for (let i = 0; i < CONFIG.animation.ghostCount; i++) {
    const ghost = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: colors.fur, transparent: true, opacity: CONFIG.animation.ghostOpacity * (1 - i / CONFIG.animation.ghostCount), depthWrite: false, toneMapped: false });
    addMesh(ghost, geometry.sphere, material, [0, 0.61, -(i + 1) * CONFIG.animation.ghostSpacing], [build.body, build.body * 0.92, build.body * 0.84]);
    addMesh(ghost, geometry.sphere, material, [0, 1.20, 0.06 - (i + 1) * CONFIG.animation.ghostSpacing], [build.head, build.head * 0.96, build.head * 0.94]);
    ghost.visible = false;
    model.add(ghost);
    ghosts.push(ghost);
  }

  const dizzyStars = new THREE.Group();
  dizzyStars.position.set(0, 1.93, 0);
  const starMaterial = new THREE.MeshBasicMaterial({ color: '#FFD166', toneMapped: false });
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 2 / 3;
    addMesh(dizzyStars, geometry.sphere, starMaterial, [Math.sin(angle) * 0.42, 0, Math.cos(angle) * 0.42], [0.07, 0.07, 0.07]);
  }
  dizzyStars.visible = false;
  model.add(dizzyStars);

  const starAura = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 16, 12),
    new THREE.MeshBasicMaterial({ color: '#FFD166', transparent: true, opacity: 0.18, side: THREE.BackSide, depthWrite: false, toneMapped: false }),
  );
  starAura.position.y = 1.05;
  starAura.visible = false;
  model.add(starAura);

  let facing = 0;
  let headFacing = 0;
  let initialized = false;
  let tumbleAngle = 0;
  let eliminatedT = 0;
  let appliedKnockLift = 0;
  const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
  const damp = (current, target, speed, dt) => current + (target - current) * (1 - Math.exp(-speed * dt));
  const clamp01 = (value) => Math.max(0, Math.min(1, value));

  function update(dt, fighter) {
    const walk = fighter.anim.walk;
    const phase = fighter.anim.walkPhase;
    const breathe = fighter.anim.breathe;
    const flash = clamp01((fighter.hitFlashT ?? 0) / CONFIG.animation.hitFlashTime);
    for (const shell of flashMeshes) {
      shell.visible = flash > 0.01;
      shell.material.opacity = flash * 0.62;
    }
    if (!initialized) {
      facing = fighter.facing;
      headFacing = fighter.facing;
      initialized = true;
    }
    facing = wrap(facing + wrap(fighter.facing - facing) * (1 - Math.exp(-CONFIG.animation.facingDamp * dt)));
    headFacing = wrap(headFacing + wrap(fighter.facing - headFacing) * (1 - Math.exp(-10 * dt)));
    group.rotation.y = facing;
    const crossed = fighter.eliminated || fighter.dizzyT > 0;
    for (const eye of eyes) {
      for (const normal of eye.userData.normal) normal.visible = !crossed;
      eye.userData.cross.visible = crossed;
      eye.scale.y = damp(eye.scale.y, fighter.anim.blink && !crossed ? 0.08 : 1, 28, dt);
    }

    if (fighter.eliminated) {
      eliminatedT += dt;
      appliedKnockLift = 0;
      group.visible = true;
      group.scale.setScalar(damp(group.scale.x, scale, 14, dt));
      tumbleAngle = Math.min(Math.PI * 8, tumbleAngle + dt * Math.PI * 8 / 1.1);
      model.rotation.x = damp(model.rotation.x, tumbleAngle, 20, dt);
      model.rotation.y = damp(model.rotation.y, 0, 14, dt);
      model.rotation.z = damp(model.rotation.z, 0.3, 12, dt);
      model.position.x = damp(model.position.x, 0, 14, dt);
      model.position.y = damp(model.position.y, 0, 14, dt);
      model.position.z = damp(model.position.z, 0, 14, dt);
      model.scale.x = damp(model.scale.x, 1, 14, dt);
      model.scale.y = damp(model.scale.y, 1, 14, dt);
      model.scale.z = damp(model.scale.z, 1, 14, dt);
      head.rotation.x = damp(head.rotation.x, -0.3, 16, dt);
      head.rotation.y = damp(head.rotation.y, wrap(headFacing - facing), 12, dt);
      arms[0].rotation.x = damp(arms[0].rotation.x, -1.4, 18, dt);
      arms[1].rotation.x = damp(arms[1].rotation.x, -1.4, 18, dt);
      arms[0].rotation.z = damp(arms[0].rotation.z, 130 * Math.PI / 180, 18, dt);
      arms[1].rotation.z = damp(arms[1].rotation.z, -130 * Math.PI / 180, 18, dt);
      legs[0].rotation.z = damp(legs[0].rotation.z, 0.8, 18, dt);
      legs[1].rotation.z = damp(legs[1].rotation.z, -0.8, 18, dt);
      dizzyStars.visible = false;
      starAura.visible = false;
      for (const ghost of ghosts) ghost.visible = false;
      for (const glow of fistGlows) glow.visible = false;
      return;
    }

    eliminatedT = 0;
    group.visible = fighter.isPlayer && fighter.invulnT > 0 && fighter.starT <= 0
      ? Math.floor(fighter.invulnT * 20) % 2 === 0
      : true;
    group.scale.setScalar(damp(group.scale.x, scale * (1 + flash * 0.04), 24, dt));
    group.rotation.z = damp(group.rotation.z, 0, 18, dt);
    const knockLift = Math.max(0, (fighter.anim.knockLift ?? 0) - (fighter.pos?.y ?? 0));
    const airborne = (!fighter.onGround || knockLift > 0.01) && fighter.state !== 'falling';
    const stagger = (fighter.staggerT ?? 0) > 0 ? 1 : 0;
    const getUp = clamp01((fighter.getUpT ?? 0) / CONFIG.combat.getUpTime);
    const charge = clamp01(fighter.anim.charge ?? 0);
    const dizzy = fighter.dizzyT > 0 ? Math.sin(breathe * Math.PI * 12) * 4 * Math.PI / 180 : 0;
    const breath = Math.sin(breathe * CONFIG.animation.idleFrequency) * CONFIG.animation.idleScale * (1 - walk);
    torso.mesh.scale.x = damp(torso.mesh.scale.x, torso.baseScale.x * (1 - breath * 0.4), 16, dt);
    torso.mesh.scale.y = damp(torso.mesh.scale.y, torso.baseScale.y * (1 + breath), 16, dt);
    torso.mesh.scale.z = damp(torso.mesh.scale.z, torso.baseScale.z * (1 - breath * 0.4), 16, dt);

    let twist = 0;
    let reach = 0;
    let punchX = 0;
    let otherPunchX = 0;
    let armLength = 1;
    let fistSize = 1;
    let activeSquash = 1;
    let activeStretch = 1;
    let attackCrouch = 0;
    let shoulderBack = 0;
    let fistBack = 0;
    const attack = fighter.attack;
    if (attack) {
      const move = MOVES[attack.move];
      const attackReach = attack.move === 'charged' ? 1.2 : 0.7;
      if (attack.phase === 'startup') {
        const progress = clamp01(attack.t / Math.max(0.01, move.startup));
        twist = -30 * Math.PI / 180 * progress;
        reach = -0.12 * progress;
        punchX = 0.75 * progress;
        fistSize = 1 + 0.25 * progress;
        attackCrouch = 0.12 * progress;
        shoulderBack = 0.25 * progress;
        fistBack = 0.2 * progress;
      } else if (attack.phase === 'active') {
        const smear = 1 - clamp01(attack.t / CONFIG.animation.smearDuration);
        twist = 35 * Math.PI / 180;
        reach = attackReach;
        punchX = -1.8;
        otherPunchX = 100 * Math.PI / 180;
        armLength = 1.6 + smear * 0.18;
        fistSize = 1.7;
        activeSquash = 0.82;
        activeStretch = 1.12 + smear * 0.08;
      } else {
        const progress = clamp01(attack.t / Math.max(0.01, move.recovery));
        const remaining = 1 - progress;
        const overshoot = Math.sin(progress * Math.PI);
        twist = 35 * Math.PI / 180 * remaining - 8 * Math.PI / 180 * overshoot;
        reach = attackReach * remaining * (1 + 0.15 * overshoot);
        punchX = -1.8 * remaining + 0.2 * overshoot;
        otherPunchX = 100 * Math.PI / 180 * remaining;
        armLength = Math.min(1.65, 1 + 0.6 * remaining * (1 + 0.15 * overshoot));
        fistSize = Math.min(1.75, 1 + 0.7 * remaining * (1 + 0.15 * overshoot));
        activeSquash = 1 - 0.18 * remaining;
        activeStretch = 1 + 0.12 * remaining;
      }
    }

    if (fighter.tumbleT > 0) tumbleAngle += dt * Math.PI * 2 * CONFIG.animation.tumbleTurns / CONFIG.combat.tumbleTime;
    else tumbleAngle = damp(wrap(tumbleAngle), 0, 16, dt);
    const landing = clamp01(Math.max(fighter.landT ?? 0, fighter.anim.knockLandT ?? 0) / CONFIG.physics.landingDuration);
    const landingBounce = Math.sin((1 - landing) * Math.PI) * CONFIG.animation.landingBounce;
    const squash = 1 - (1 - CONFIG.animation.landingSquash) * landing;
    const scaleY = Math.max(0.65, Math.min(1.12, squash * activeSquash * (1 - 0.2 * stagger)));
    const scaleXZ = Math.max(1, Math.min(1.2, (1 + (1 - squash) * 0.45) * activeStretch * (1 + 0.1 * stagger)));
    const idleSway = Math.sin(breathe * 0.8) * 0.05 * (1 - walk);
    const chargeShake = Math.sin(breathe * Math.PI * 40) * 0.04 * charge;
    const targetModelX = fighter.anim.lean * CONFIG.animation.dashLean + tumbleAngle - 30 * Math.PI / 180 * stagger + (fighter.grabbedBy ? 0.28 : 0) + getUp * 0.35;
    model.rotation.x = damp(model.rotation.x, targetModelX, 20, dt);
    model.rotation.y = damp(model.rotation.y, twist, attack?.phase === 'recovery' ? 12 : 22, dt);
    model.rotation.z = damp(model.rotation.z, -Math.sin(phase) * CONFIG.animation.walkTilt * walk + dizzy, 18, dt);
    model.position.x = damp(model.position.x, idleSway + chargeShake, 22, dt);
    model.position.y = damp(model.position.y - appliedKnockLift, (airborne ? 0 : Math.abs(Math.sin(phase)) * CONFIG.animation.walkBob * walk) + landingBounce - attackCrouch - charge * 0.18 - getUp * 0.18, 20, dt);
    model.position.z = damp(model.position.z, reach, 24, dt);
    appliedKnockLift = knockLift;
    model.position.y += appliedKnockLift;
    model.scale.x = damp(model.scale.x, scaleXZ, 24, dt);
    model.scale.y = damp(model.scale.y, scaleY, 24, dt);
    model.scale.z = damp(model.scale.z, scaleXZ, 24, dt);

    const idleLook = Math.sin(breathe * 0.37 + Number(fighter.id?.slice(1) ?? 0)) > 0.94 ? 0.22 : 0;
    head.rotation.x = damp(head.rotation.x, (airborne ? -0.10 : 0) - 45 * Math.PI / 180 * stagger, 20, dt);
    head.rotation.y = damp(head.rotation.y, wrap(headFacing - facing) - twist * 0.55 + idleLook * (1 - walk), attack?.phase === 'recovery' ? 24 : 14, dt);
    head.rotation.z = damp(head.rotation.z, Math.sin(breathe * 1.3) * 0.035 * (1 - walk) + dizzy, 16, dt);

    const swing = Math.sin(phase);
    const legTargets = [airborne ? 0.62 : swing * CONFIG.animation.legSwing * walk, airborne ? -0.42 : -swing * CONFIG.animation.legSwing * walk];
    const armTargets = [airborne ? -2.25 : -swing * CONFIG.animation.armSwing * walk, airborne ? -2.25 : swing * CONFIG.animation.armSwing * walk];
    armTargets[0] += otherPunchX;
    armTargets[1] += punchX;
    if (attack?.move === 'grab' || attack?.move === 'throw') armTargets[0] = punchX;
    if (attack?.move === 'slam') {
      armTargets[0] = -2.7;
      armTargets[1] = -2.7;
    }
    if (fighter.grabTarget) {
      armTargets[0] = -Math.PI * 0.48;
      armTargets[1] = -Math.PI * 0.48;
    }
    if (fighter.grabbedBy) {
      armTargets[0] = Math.sin(breathe * 18) * 0.8;
      armTargets[1] = -Math.sin(breathe * 18) * 0.8;
      legTargets[0] = Math.sin(breathe * 15) * 0.6;
      legTargets[1] = -Math.sin(breathe * 15) * 0.6;
    }
    legTargets[0] -= getUp * 1.1;
    legTargets[1] += getUp * 0.35;
    const spread = Math.max(stagger, fighter.tumbleT > 0 ? 1 : 0);
    for (let i = 0; i < 2; i++) {
      arms[i].rotation.x = damp(arms[i].rotation.x, armTargets[i], 26, dt);
      arms[i].rotation.z = damp(arms[i].rotation.z, (i === 0 ? 1 : -1) * (0.08 + spread * (130 * Math.PI / 180 - 0.08)), 22, dt);
      arms[i].position.z = damp(arms[i].position.z, 0.02 - (i === 1 ? shoulderBack : 0), 24, dt);
      arms[i].scale.y = damp(arms[i].scale.y, i === 1 ? armLength : 1, 26, dt);
      const targetFist = i === 1 ? fistSize : 1;
      fists[i].position.z = damp(fists[i].position.z, 0.025 - (i === 1 ? fistBack : 0), 24, dt);
      fists[i].scale.setScalar(damp(fists[i].scale.x, targetFist, 26, dt));
      legs[i].rotation.x = damp(legs[i].rotation.x, legTargets[i], 24, dt);
      legs[i].rotation.z = damp(legs[i].rotation.z, 0, 20, dt);
      fistGlows[i].visible = charge > 0.03 || attack?.move === 'charged';
    }

    const lagPhase = walk * CONFIG.physics.maxSpeed * CONFIG.physics.walkCycleSpeed * 0.12;
    for (let i = 0; i < ears.length; i++) {
      const ear = ears[i];
      const lag = Math.sin(phase - lagPhase) * 0.2 * walk;
      const idle = Math.sin(breathe * 1.7 + i - 0.12) * 0.05 * (1 - walk);
      ear.rotation.z = damp(ear.rotation.z, ear.userData.baseRotation + lag + idle, 8.3, dt);
      ear.rotation.x = damp(ear.rotation.x, -walk * 0.14 + charge * 0.12, 8.3, dt);
    }
    dizzyStars.visible = fighter.dizzyT > 0;
    dizzyStars.rotation.y += dt * 8;
    dizzyStars.rotation.z = Math.sin(breathe * 5) * 0.12;
    tail.rotation.y = damp(tail.rotation.y, Math.sin(breathe * 3 + (phase - lagPhase) * 0.25) * (0.22 + walk * 0.16), 8.3, dt);
    tail.rotation.z = damp(tail.rotation.z, Math.sin(breathe * 2.1 - lagPhase * 0.3) * 0.14, 8.3, dt);
    starAura.visible = fighter.starT > 0;
    starAura.rotation.y += dt * 2.4;
    starAura.scale.setScalar(1 + Math.sin(breathe * 5) * 0.04);
    for (const ghost of ghosts) {
      ghost.visible = fighter.state === 'dash' || fighter.starT > 0;
      for (const child of ghost.children) {
        if (!child.isMesh) continue;
        child.material.color.set(fighter.starT > 0 ? '#FFD166' : colors.fur);
      }
    }
  }

  function dispose() {
    const sharedGeometries = new Set([...Object.values(geometry), ...capsuleCache.values()]);
    const sharedMaterials = new Set([...materialCache.values(), outlineMaterial]);
    const ownedGeometries = new Set();
    const ownedMaterials = new Set();
    group.traverse((object) => {
      if (object.geometry && !sharedGeometries.has(object.geometry)) ownedGeometries.add(object.geometry);
      if (!object.material) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!sharedMaterials.has(material)) ownedMaterials.add(material);
      }
    });
    for (const owned of ownedGeometries) owned.dispose();
    for (const owned of ownedMaterials) owned.dispose();
  }

  return { group, update, character, itemAnchor, labelY, dispose };
}

function idColor(character, part) {
  if (character.id === 'panda' && (part === 'arm' || part === 'leg')) return character.colors.fur2;
  return character.colors.fur;
}
