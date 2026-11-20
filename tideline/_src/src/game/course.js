import * as THREE from 'three';

// The Tideline course: 8 buoy gates around the island, run counter-clockwise.
// Gate 0 is the start/finish line (banner arch). Positions are validated against
// the island heightfield and the rock field so every gate sits in navigable water.

const GATE_DEFS = [
  { b: 0, r: 500 },
  { b: 42, r: 452 },
  { b: 88, r: 520 },
  { b: 134, r: 446 },
  { b: 180, r: 508 },
  { b: 224, r: 450 },
  { b: 268, r: 528 },
  { b: 314, r: 452 },
];
export const GATE_WIDTH = 30;
export const LAPS = 3;

function numberTexture(n, active) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = active ? '#ffc84a' : '#f2f0e8';
  g.fillRect(0, 0, 128, 96);
  g.fillStyle = '#0b2536';
  g.font = '900 64px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(n), 64, 52);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function bannerTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#0b2536'; g.fillRect(0, 0, 1024, 128);
  // checkered edges
  for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) {
    g.fillStyle = (i + j) % 2 ? '#f2f0e8' : '#0b2536';
    g.fillRect(i * 16, j * 16, 16, 16);
    g.fillRect(1024 - 128 + i * 16, j * 16, 16, 16);
    g.fillRect(i * 16, 96 + j * 16, 16, 16);
    g.fillRect(1024 - 128 + i * 16, 96 + j * 16, 16, 16);
  }
  g.fillStyle = '#ffc84a';
  g.font = '900 72px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('START · FINISH', 512, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const BEAM_VERT = /* glsl */`
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const BEAM_FRAG = /* glsl */`
precision highp float;
uniform float uTime;
uniform vec3 uColor;
in vec2 vUv;
out vec4 fragColor;
void main() {
  float fade = pow(1.0 - vUv.y, 1.6);
  float pulse = 0.75 + 0.25 * sin(uTime * 3.0 - vUv.y * 8.0);
  float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
  fragColor = vec4(uColor, fade * pulse * (0.16 + 0.2 * edge));
}`;

function buildBuoy(num) {
  const group = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xe8452f, roughness: 0.5, metalness: 0.05 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f0e8, roughness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x22303c, roughness: 0.6 });

  const float = new THREE.Mesh(new THREE.SphereGeometry(1.15, 20, 14), red);
  float.scale.y = 0.85;
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.13, 0.14, 8, 24), white);
  band.rotation.x = Math.PI / 2;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.4, 8), dark);
  mast.position.y = 2.2;
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffc84a, emissive: 0xffc84a, emissiveIntensity: 0.4, roughness: 0.3 }),
  );
  light.position.y = 3.95;

  const flagGeo = new THREE.BufferGeometry();
  flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1.5, -0.35, 0, 0, -0.95, 0], 3));
  flagGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 0.5, 0, 0], 2));
  flagGeo.computeVertexNormals();
  const flagMat = new THREE.MeshStandardMaterial({ map: numberTexture(num, false), side: THREE.DoubleSide, roughness: 0.7 });
  const flag = new THREE.Mesh(flagGeo, flagMat);
  flag.position.set(0.05, 3.75, 0);

  group.add(float, band, mast, light, flag);
  group.traverse((o) => { if (o.isMesh) { o.layers.enable(1); o.receiveShadow = true; } });
  return { group, light, flagMat, num };
}

export function buildCourse(scene, heightAt, rocks) {
  const group = new THREE.Group();
  scene.add(group);

  // gate centres, pushed out to safe water
  const gates = GATE_DEFS.map((d, i) => {
    const a = (d.b * Math.PI) / 180;
    let r = d.r;
    const ok = (rr) => {
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (heightAt(x, z) > -4) return false;
      for (const rk of rocks) if (Math.hypot(x - rk.x, z - rk.z) < rk.r + 24) return false;
      return true;
    };
    while (!ok(r) && r < 760) r += 8;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, i };
  });

  // travel normal at each gate = smoothed direction of the racing line
  gates.forEach((g, i) => {
    const prev = gates[(i + gates.length - 1) % gates.length];
    const next = gates[(i + 1) % gates.length];
    let nx = next.x - prev.x, nz = next.z - prev.z;
    const l = Math.hypot(nx, nz) || 1;
    g.nx = nx / l; g.nz = nz / l;
    g.dx = -g.nz; g.dz = g.nx;
    g.width = GATE_WIDTH;
  });

  const buoys = [];
  gates.forEach((g, i) => {
    g.buoys = [];
    for (const s of [-1, 1]) {
      const b = buildBuoy(i === 0 ? '★' : i);
      b.group.position.set(g.x + g.dx * s * g.width * 0.5, 0, g.z + g.dz * s * g.width * 0.5);
      b.phase = Math.random() * Math.PI * 2;
      group.add(b.group);
      g.buoys.push(b);
      buoys.push(b);
    }
  });

  // start/finish banner across gate 0
  const g0 = gates[0];
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x22303c, roughness: 0.6 });
  for (const s of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 9.5, 8), poleMat);
    pole.position.set(g0.x + g0.dx * s * g0.width * 0.5, 4.2, g0.z + g0.dz * s * g0.width * 0.5);
    pole.layers.enable(1);
    group.add(pole);
  }
  const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTexture(), side: THREE.FrontSide, roughness: 0.7 });
  const bannerGeo = new THREE.PlaneGeometry(g0.width, 2.4);
  const banner = new THREE.Mesh(bannerGeo, bannerMat);
  banner.position.set(g0.x, 8.2, g0.z);
  banner.rotation.y = Math.atan2(g0.nx, g0.nz);
  banner.layers.enable(1);
  group.add(banner);
  // second face so the text reads correctly from both directions
  const bannerBack = new THREE.Mesh(bannerGeo, bannerMat);
  bannerBack.position.copy(banner.position);
  bannerBack.rotation.y = banner.rotation.y + Math.PI;
  bannerBack.layers.enable(1);
  group.add(bannerBack);

  // golden beacon beam over the active gate
  const beamMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xffc84a) } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.6, 70, 14, 1, true), beamMat);
  beam.position.y = 35;
  beam.renderOrder = 5;
  group.add(beam);

  // coastline polygon for the minimap
  const coast = [];
  for (let k = 0; k < 160; k++) {
    const a = (k / 160) * Math.PI * 2;
    let r = 120;
    while (r < 820 && heightAt(Math.cos(a) * r, Math.sin(a) * r) > 0) r += 4;
    coast.push([Math.cos(a) * r, Math.sin(a) * r]);
  }

  let active = -1;
  const texCache = new Map();
  const setActive = (i) => {
    active = i;
    const g = gates[i];
    beam.position.set(g.x, 35, g.z);
    for (const gg of gates) for (const b of gg.buoys) {
      const isAct = gg === g;
      if (!texCache.has(b.num + (isAct ? 'a' : 'n'))) texCache.set(b.num + (isAct ? 'a' : 'n'), numberTexture(b.num, isAct));
      b.flagMat.map = texCache.get(b.num + (isAct ? 'a' : 'n'));
      b.flagMat.needsUpdate = true;
      b.light.material.emissiveIntensity = isAct ? 1.6 : 0.35;
      b.light.material.color.set(isAct ? 0xffc84a : 0x8a5a20);
      b.light.material.emissive.set(isAct ? 0xffc84a : 0x30200a);
    }
  };

  // water heights: one query point per buoy, in `buoys` order
  const buoyPoints = new Float32Array(buoys.length * 2);
  const collectBuoyPoints = () => {
    buoys.forEach((b, i) => { buoyPoints[i * 2] = b.group.position.x; buoyPoints[i * 2 + 1] = b.group.position.z; });
    return buoyPoints;
  };

  const update = (t, result, offset = 0, count = 0) => {
    beamMat.uniforms.uTime.value = t;
    buoys.forEach((b, i) => {
      let h = 0;
      const k = offset + i;
      if (result && count > k) h = result[k * 4];
      b.group.position.y = h + 0.05;
      b.group.rotation.z = Math.sin(t * 1.25 + b.phase) * 0.07;
      b.group.rotation.x = Math.cos(t * 1.1 + b.phase * 1.7) * 0.06;
      if (active >= 0 && gates[active].buoys.includes(b)) {
        b.light.material.emissiveIntensity = 1.3 + Math.sin(t * 5) * 0.7;
      }
    });
  };

  return { gates, buoys, group, coast, setActive, update, collectBuoyPoints, get active() { return active; } };
}