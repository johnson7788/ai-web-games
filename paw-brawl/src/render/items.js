import * as THREE from 'three';

const gradient = new THREE.DataTexture(new Uint8Array([104, 182, 255]), 3, 1, THREE.RedFormat);
gradient.minFilter = THREE.NearestFilter;
gradient.magFilter = THREE.NearestFilter;
gradient.needsUpdate = true;
const outlineMaterial = new THREE.MeshBasicMaterial({ color: '#2B2440', side: THREE.BackSide, toneMapped: false });
const toon = (color) => new THREE.MeshToonMaterial({ color, gradientMap: gradient });
const itemColors = { fish: '#8FD3FF', hammer: '#9BB8E8', bomb: '#FF8A59', glove: '#FF7A59', star: '#FFD166' };

function makeHalo(type) {
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.38, 0.55, 40),
    new THREE.MeshBasicMaterial({ color: itemColors[type], transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.035;
  return halo;
}

function mesh(parent, geometry, color, position = [0, 0, 0], scale = [1, 1, 1], outline = true) {
  const part = new THREE.Mesh(geometry, typeof color === 'string' ? toon(color) : color);
  part.position.set(...position);
  part.scale.set(...scale);
  part.castShadow = true;
  parent.add(part);
  if (outline) {
    const edge = new THREE.Mesh(geometry, outlineMaterial);
    edge.scale.setScalar(1.045);
    edge.castShadow = false;
    part.add(edge);
  }
  return part;
}

export function createItemModel(type) {
  const group = new THREE.Group();
  if (type === 'fish') {
    mesh(group, new THREE.SphereGeometry(0.34, 18, 12), '#8FD3FF', [0, 0, 0], [1.35, 0.62, 0.48]);
    const tail = mesh(group, new THREE.ConeGeometry(0.24, 0.38, 3), '#6B5B95', [-0.52, 0, 0], [1, 1, 0.55]);
    tail.rotation.z = -Math.PI / 2;
    mesh(group, new THREE.SphereGeometry(0.045, 10, 8), '#2B2440', [0.28, 0.09, 0.15], [1, 1, 1], false);
    group.rotation.z = -0.25;
  } else if (type === 'hammer') {
    mesh(group, new THREE.CylinderGeometry(0.065, 0.075, 0.78, 10), '#B98258', [0, -0.12, 0]);
    mesh(group, new THREE.BoxGeometry(0.66, 0.34, 0.36), '#9BB8E8', [0, 0.30, 0]);
    mesh(group, new THREE.BoxGeometry(0.10, 0.38, 0.40), '#FFD166', [-0.25, 0.30, 0]);
    mesh(group, new THREE.BoxGeometry(0.10, 0.38, 0.40), '#FFD166', [0.25, 0.30, 0]);
  } else if (type === 'bomb') {
    mesh(group, new THREE.SphereGeometry(0.32, 18, 12), '#3D374D');
    mesh(group, new THREE.CylinderGeometry(0.07, 0.09, 0.12, 10), '#B98258', [0, 0.31, 0]);
    const fuse = mesh(group, new THREE.CylinderGeometry(0.025, 0.025, 0.28, 7), '#F4D9B0', [0.08, 0.46, 0]);
    fuse.rotation.z = -0.55;
    const spark = new THREE.Group();
    spark.name = 'spark';
    spark.position.set(0.16, 0.58, 0);
    const sparkMaterial = new THREE.MeshBasicMaterial({ color: '#FF8A3D', toneMapped: false });
    mesh(spark, new THREE.SphereGeometry(0.075, 8, 6), sparkMaterial, [0, 0, 0], [1, 1, 1], false);
    for (let i = 0; i < 3; i++) {
      const angle = i * Math.PI * 2 / 3;
      mesh(spark, new THREE.SphereGeometry(0.026, 6, 4), sparkMaterial, [Math.cos(angle) * 0.13, Math.sin(angle) * 0.13, 0], [1, 1, 1], false);
    }
    group.add(spark);
  } else if (type === 'glove') {
    mesh(group, new THREE.SphereGeometry(0.31, 18, 12), '#FF7A59', [0, 0.12, 0], [1, 1.08, 0.82]);
    mesh(group, new THREE.SphereGeometry(0.15, 14, 10), '#FF9A7D', [-0.25, 0.04, 0.04]);
    mesh(group, new THREE.CylinderGeometry(0.19, 0.17, 0.26, 14), '#6B5B95', [0, -0.24, 0]);
  } else {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const angle = Math.PI / 2 + i * Math.PI / 5;
      const radius = i % 2 === 0 ? 0.42 : 0.19;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.13, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 2 });
    geometry.center();
    mesh(group, geometry, '#FFD166');
    const particles = new THREE.Group();
    particles.name = 'starParticles';
    const particleMaterial = new THREE.MeshBasicMaterial({ color: '#FFE49A', toneMapped: false });
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      mesh(particles, new THREE.SphereGeometry(0.035, 6, 4), particleMaterial, [Math.cos(angle) * 0.56, (i - 2) * 0.12, Math.sin(angle) * 0.56], [1, 1, 1], false);
    }
    group.add(particles);
  }
  return group;
}

function makeParachute() {
  const group = new THREE.Group();
  const canopy = mesh(group, new THREE.SphereGeometry(0.62, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#FF7A59', [0, 0, 0], [1, 0.55, 1], false);
  canopy.material.side = THREE.DoubleSide;
  const lineMaterial = new THREE.LineBasicMaterial({ color: '#6B5B95' });
  for (const side of [-1, 1]) {
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(side * 0.48, -0.02, 0), new THREE.Vector3(side * 0.12, -0.92, 0)]);
    group.add(new THREE.Line(geometry, lineMaterial));
  }
  group.position.y = 1.55;
  return group;
}

export function createItemRenderer(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const ground = new Map();
  const bombs = new Map();
  const held = new Map();

  function remove(map, id) {
    const entry = map.get(id);
    if (!entry) return;
    entry.group.parent?.remove(entry.group);
    const geometries = new Set();
    const materials = new Set();
    entry.group.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (!object.material) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material !== outlineMaterial) materials.add(material);
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    map.delete(id);
  }

  function sync(sim, actors, dt, time) {
    const activeGround = new Set();
    for (const item of sim.items ?? []) {
      activeGround.add(item.id);
      let entry = ground.get(item.id);
      if (!entry) {
        const group = new THREE.Group();
        const model = createItemModel(item.type);
        model.position.y = 0.63;
        const parachute = makeParachute();
        const halo = makeHalo(item.type);
        group.add(model, parachute, halo);
        root.add(group);
        entry = { group, model, parachute, halo };
        ground.set(item.id, entry);
      }
      entry.group.position.set(item.pos.x, item.pos.y, item.pos.z);
      entry.model.rotation.y += dt * (item.type === 'star' ? 2.8 : 0.55);
      const phase = Number.parseInt(String(item.id).replace(/\D/g, ''), 10) || 0;
      entry.model.position.y = 0.63 + Math.sin(time * 2 + phase * 0.4) * 0.06;
      entry.model.scale.setScalar(1.45 * (item.type === 'star' ? 1 + Math.sin(time * 5) * 0.08 : 1));
      const particles = entry.model.getObjectByName('starParticles');
      if (particles) particles.rotation.y -= dt * 1.8;
      entry.halo.scale.setScalar(1 + Math.sin(time * 2.4 + phase) * 0.08);
      entry.halo.material.opacity = 0.22 + Math.sin(time * 2.4 + phase) * 0.07;
      entry.halo.visible = item.pos.y <= 0.25;
      entry.parachute.visible = item.pos.y > 0.25;
    }
    for (const id of ground.keys()) if (!activeGround.has(id)) remove(ground, id);

    const activeBombs = new Set();
    for (const bomb of sim.bombs ?? []) {
      activeBombs.add(bomb.id);
      let entry = bombs.get(bomb.id);
      if (!entry) {
        const group = createItemModel('bomb');
        root.add(group);
        entry = { group };
        bombs.set(bomb.id, entry);
      }
      entry.group.position.set(bomb.pos.x, bomb.pos.y, bomb.pos.z);
      entry.group.rotation.x += dt * 6;
      const spark = entry.group.getObjectByName('spark');
      if (spark) {
        spark.scale.setScalar(0.8 + Math.sin(time * 35) * 0.25);
        spark.rotation.z = time * 8;
      }
    }
    for (const id of bombs.keys()) if (!activeBombs.has(id)) remove(bombs, id);

    const activeHeld = new Set();
    for (const fighter of sim.fighters) {
      if (!fighter.heldItem || fighter.eliminated) continue;
      const actor = actors.get(fighter.id);
      if (!actor?.itemAnchor) continue;
      activeHeld.add(fighter.id);
      let entry = held.get(fighter.id);
      if (!entry || entry.type !== fighter.heldItem.type || entry.anchor !== actor.itemAnchor) {
        remove(held, fighter.id);
        const group = createItemModel(fighter.heldItem.type);
        group.scale.setScalar(0.72);
        group.position.set(0.05, 0.10, 0.18);
        actor.itemAnchor.add(group);
        entry = { group, type: fighter.heldItem.type, anchor: actor.itemAnchor };
        held.set(fighter.id, entry);
      }
      entry.group.rotation.y = Math.sin(time * 2) * 0.08;
    }
    for (const id of held.keys()) if (!activeHeld.has(id)) remove(held, id);
  }

  function clear() {
    for (const map of [ground, bombs, held]) for (const id of [...map.keys()]) remove(map, id);
  }

  return { root, sync, clear };
}
