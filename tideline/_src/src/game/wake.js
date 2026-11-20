import * as THREE from 'three';

// Boat wake & spray: CPU-spawned, GPU-animated point sprites. Foam rides the
// surface and spreads; spray arcs up and falls; gold sparks burst at gates.
const CAP = 1200;

const VERT = /* glsl */`
uniform float uTime;
in vec3 aVel;
in float aBirth;
in float aLife;
in float aSize;
in float aKind;
out float vAlpha;
out float vKind;
void main() {
  float age = uTime - aBirth;
  vKind = aKind;
  if (age < 0.0 || age > aLife || aLife <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
    return;
  }
  float t = age / aLife;
  vec3 p = position + aVel * age;
  if (aKind > 1.5) p.y -= 3.5 * age * age;        // sparks fall
  else if (aKind > 0.5) p.y -= 4.9 * age * age;   // spray droplets
  else p.y += 0.12 * age;                          // foam floats
  vAlpha = (1.0 - t) * (aKind > 0.5 ? 0.85 : 0.5);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float size = aSize * (aKind > 0.5 ? (1.0 - 0.4 * t) : (1.0 + 2.4 * t));
  gl_PointSize = clamp(size * 320.0 / max(1.0, -mv.z), 0.0, 90.0);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */`
precision highp float;
in float vAlpha;
in float vKind;
out vec4 fragColor;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  float a = smoothstep(0.5, 0.12, r) * vAlpha;
  if (a < 0.01) discard;
  vec3 col = vKind > 1.5 ? vec3(1.0, 0.82, 0.35) : vec3(0.92, 0.97, 1.0);
  fragColor = vec4(col, a);
}`;

export class Wake {
  constructor() {
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(CAP * 3);
    this.vel = new Float32Array(CAP * 3);
    this.birth = new Float32Array(CAP).fill(-1e9);
    this.life = new Float32Array(CAP);
    this.size = new Float32Array(CAP);
    this.kind = new Float32Array(CAP);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aVel', new THREE.BufferAttribute(this.vel, 3));
    geo.setAttribute('aBirth', new THREE.BufferAttribute(this.birth, 1));
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aKind', new THREE.BufferAttribute(this.kind, 1));
    this.mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { uTime: { value: 0 } },
      transparent: true, depthWrite: false,
    });
    this.mesh = new THREE.Points(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.cursor = 0;
    this.time = 0;
    this.geo = geo;
    this._dirty = false;
  }

  emit(x, y, z, vx, vy, vz, life, size, kind = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % CAP;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.birth[i] = this.time;
    this.life[i] = life;
    this.size[i] = size;
    this.kind[i] = kind;
    this._dirty = true;
  }

  // stern foam trail + bow spray, scaled by speed
  boatWake(boat, boosting) {
    const sp = boat.speed;
    if (sp < 3.5) return;
    const fx = Math.cos(boat.heading), fz = Math.sin(boat.heading);
    const rx = -fz, rz = fx;
    const n = sp > 25 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const side = (Math.random() * 2 - 1) * 1.1;
      const x = boat.pos.x - fx * 3.4 + rx * side;
      const z = boat.pos.z - fz * 3.4 + rz * side;
      this.emit(x, boat.y + 0.15, z,
        -fx * sp * 0.22 + rx * side * 1.6 + (Math.random() - 0.5),
        0.25 + Math.random() * 0.3,
        -fz * sp * 0.22 + rz * side * 1.6 + (Math.random() - 0.5),
        1.3 + Math.random() * 1.1, 0.9 + Math.random() * 0.9, 0);
    }
    if (sp > 20) {
      for (const s of [-1, 1]) {
        const x = boat.pos.x + fx * 2.6 + rx * s * 1.0;
        const z = boat.pos.z + fz * 2.6 + rz * s * 1.0;
        this.emit(x, boat.y + 0.4, z,
          rx * s * (2 + sp * 0.12) + fx * sp * 0.15,
          1.6 + Math.random() * 2.2,
          rz * s * (2 + sp * 0.12) + fz * sp * 0.15,
          0.5 + Math.random() * 0.35, 0.35 + Math.random() * 0.3, 1);
      }
    }
    if (boosting) {
      for (let i = 0; i < 3; i++) {
        this.emit(boat.pos.x - fx * 3.7, boat.y + 0.3, boat.pos.z - fz * 3.7,
          -fx * 6 + (Math.random() - 0.5) * 3, 1.5 + Math.random() * 2, -fz * 6 + (Math.random() - 0.5) * 3,
          0.6, 0.6, 1);
      }
    }
  }

  burst(x, y, z, count = 36, kind = 2) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 3 + Math.random() * 7;
      this.emit(x, y + 0.4, z, Math.cos(a) * v, 3 + Math.random() * 5, Math.sin(a) * v,
        0.7 + Math.random() * 0.5, 0.4 + Math.random() * 0.35, kind);
    }
  }

  splash(x, y, z, count = 22) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 2 + Math.random() * 5;
      this.emit(x, y + 0.3, z, Math.cos(a) * v, 2.5 + Math.random() * 4, Math.sin(a) * v,
        0.55 + Math.random() * 0.3, 0.45, 1);
    }
  }

  update(t) {
    this.time = t;
    this.mat.uniforms.uTime.value = t;
    if (this._dirty) {
      for (const k of ['position', 'aVel', 'aBirth', 'aLife', 'aSize', 'aKind']) this.geo.attributes[k].needsUpdate = true;
      this._dirty = false;
    }
  }
}