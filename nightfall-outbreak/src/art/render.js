// src/art/render.js — 真 3D 场景：程序化血月天空 / 湿地面 / 三层光照 / 体积雾 / 后处理
// 「伪 3A」配方来自 references/3d-shooter-template.md，全部用 three r160 核心实现，不依赖 addons。
import * as THREE from "three";
import { GAME } from "config/game.config.js";

const W = GAME.design.width;
const H = GAME.design.height;

const QUAD_VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const BRIGHT_FRAG = `
varying vec2 vUv;
uniform sampler2D tDiffuse;
void main(){
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor = vec4(c * smoothstep(0.52, 1.15, l), 1.0);
}
`;

const BLUR_FRAG = `
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform vec2 uDir;
void main(){
  vec3 s = texture2D(tDiffuse, vUv).rgb * 0.227;
  s += texture2D(tDiffuse, vUv + uDir * 1.3846).rgb * 0.316;
  s += texture2D(tDiffuse, vUv - uDir * 1.3846).rgb * 0.316;
  s += texture2D(tDiffuse, vUv + uDir * 3.2308).rgb * 0.070;
  s += texture2D(tDiffuse, vUv - uDir * 3.2308).rgb * 0.070;
  gl_FragColor = vec4(s, 1.0);
}
`;

const COMPOSITE_FRAG = `
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform vec2 uResolution;
uniform float uTime;
uniform float uHit;
uniform float uBloom;
void main(){
  vec2 d = vUv - 0.5;
  float r2 = dot(d, d);
  vec2 off = d * (0.0018 + 0.006 * uHit);
  vec3 col = vec3(
    texture2D(tDiffuse, vUv + off).r,
    texture2D(tDiffuse, vUv).g,
    texture2D(tDiffuse, vUv - off).b
  );
  col += texture2D(tBloom, vUv).rgb * uBloom;
  // ACES filmic
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  // 冷夜 + 暖火的双色分级
  col = mix(col, col * vec3(0.87, 1.01, 1.09), 0.34);
  col += vec3(0.055, 0.016, 0.0) * smoothstep(0.42, 1.0, col.r);
  col *= 1.0 - 0.58 * smoothstep(0.22, 0.80, r2);
  float n = fract(sin(dot(vUv * uResolution + uTime * 17.3, vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * 0.032;
  gl_FragColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}
`;

const SKY_VERT = `
varying vec3 vDir;
void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const SKY_FRAG = `
varying vec3 vDir;
uniform float uTime;
uniform float uFlash;
uniform vec3 uMoonDir;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for(int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 sky = mix(vec3(0.052, 0.084, 0.102), vec3(0.006, 0.012, 0.028), smoothstep(0.42, 0.96, h));
  sky = mix(vec3(0.095, 0.145, 0.155), sky, smoothstep(0.44, 0.66, h));
  vec2 sp = d.xz / max(0.18, d.y + 0.45) * 9.0;
  float star = step(0.9976, hash(floor(sp * 64.0)));
  sky += star * 0.42 * smoothstep(0.58, 0.92, h);
  float cloud = fbm(d.xz * 3.2 + vec2(uTime * 0.005, uTime * 0.002));
  sky += vec3(0.085, 0.105, 0.115) * smoothstep(0.54, 0.84, cloud) * (1.0 - smoothstep(0.62, 0.95, h));
  float m = dot(d, normalize(uMoonDir));
  float disc = smoothstep(0.9974, 0.9992, m);
  float glow = pow(max(0.0, m), 88.0);
  sky += vec3(1.0, 0.56, 0.30) * disc * 1.7 + vec3(0.55, 0.19, 0.08) * glow * 0.75;
  sky += vec3(0.34, 0.42, 0.52) * uFlash * 0.45;
  gl_FragColor = vec4(sky, 1.0);
}
`;

function makeGroundTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const img = g.createImageData(256, 256);
  for (let y = 0; y < 256; y += 1) {
    for (let x = 0; x < 256; x += 1) {
      const i = (y * 256 + x) * 4;
      const n = Math.sin(x * 0.13) * Math.cos(y * 0.11) * 0.5 + (Math.random() - 0.5) * 0.9;
      const patch = Math.sin(x * 0.035 + y * 0.021) * 0.35;
      const v = Math.max(0, Math.min(1, 0.22 + n * 0.22 + patch));
      img.data[i] = Math.round(16 + v * 34);
      img.data[i + 1] = Math.round(22 + v * 38);
      img.data[i + 2] = Math.round(22 + v * 30);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Renderer3D {
  constructor({ canvas, viewport, pool, headless = false }) {
    this.viewport = viewport;
    this.pool = pool;
    this.headless = headless;
    this.time = 0;
    this.hitFlash = 0;
    this.flash = 0;
    this.nextFlash = 8 + Math.random() * 14;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x1b2b30, 0.019);
    this.camera = new THREE.PerspectiveCamera(GAME.play.hipFov, W / H, 0.05, 260);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: !headless, alpha: false, powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(this._pr());
    this.renderer.setSize(W, H, false);
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = !headless;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this._buildSky();
    this._buildGround();
    this._buildLights();
    this._buildParticles();
    this._buildPost();
    this.resize();
  }

  _buildSky() {
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uFlash: { value: 0 },
        uMoonDir: { value: new THREE.Vector3(0.55, 0.35, -0.75).normalize() }
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(190, 32, 20), this.skyMat);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
  }

  _buildGround() {
    const tex = makeGroundTexture();
    const mat = new THREE.MeshStandardMaterial({
      map: tex, bumpMap: tex, bumpScale: 0.055,
      roughness: 0.88, metalness: 0.06, color: 0x8c9a92
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220, 1, 1), mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = !this.headless;
    this.scene.add(ground);

    // 水洼：暗色镜面片，月光与火光会在上面泛出高光
    const puddleMat = new THREE.MeshStandardMaterial({
      color: 0x14282c, roughness: 0.12, metalness: 0.72,
      transparent: true, opacity: 0.72
    });
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2 + Math.random();
      const r = 7 + Math.random() * 28;
      const p = new THREE.Mesh(new THREE.CircleGeometry(0.8 + Math.random() * 2.1, 14), puddleMat);
      p.rotation.x = -Math.PI / 2;
      p.position.set(Math.cos(a) * r, 0.012, Math.sin(a) * r);
      p.scale.set(1, 0.55 + Math.random() * 0.8, 1);
      this.scene.add(p);
    }
  }

  _buildLights() {
    const hemi = new THREE.HemisphereLight(0x8fa8bb, 0x101d18, 0.72);
    this.scene.add(hemi);
    const moon = new THREE.DirectionalLight(0xffc898, 1.35);
    moon.position.set(28, 42, -34);
    moon.castShadow = !this.headless;
    if (!this.headless) {
      moon.shadow.mapSize.set(1024, 1024);
      moon.shadow.camera.left = -38;
      moon.shadow.camera.right = 38;
      moon.shadow.camera.top = 38;
      moon.shadow.camera.bottom = -38;
      moon.shadow.camera.far = 120;
      moon.shadow.bias = -0.0012;
    }
    this.scene.add(moon);
    this.moonLight = moon;

    this.fireLights = [];
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2 + 0.6;
      const l = new THREE.PointLight(0xff6a28, 2.4, 16, 2);
      l.position.set(Math.cos(a) * 15, 1.1, Math.sin(a) * 15);
      this.scene.add(l);
      this.fireLights.push(l);
    }
    this.muzzleLight = new THREE.PointLight(0xffd08a, 0, 9, 2);
    this.camera.add(this.muzzleLight);
    this.muzzleLight.position.set(0.25, -0.12, -1.1);
  }

  _buildParticles() {
    const n = 240;
    this.pCount = n;
    this.pPos = new Float32Array(n * 3);
    this.pCol = new Float32Array(n * 3);
    this.pLife = new Float32Array(n);
    this.pVel = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) this.pPos[i * 3 + 1] = -999;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pPos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.pCol, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.16, vertexColors: true, transparent: true, opacity: 0.9,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
    }));
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    this.pCursor = 0;
  }

  _buildPost() {
    // 无头浏览器（SwiftShader）关掉后处理保帧率；真实浏览器保留完整电影级链路
    this.post = !this.headless;
    const makeRT = (w, h) => new THREE.WebGLRenderTarget(Math.max(2, w), Math.max(2, h), {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false
    });
    this.rtScene = makeRT(2, 2);
    this.rtBright = makeRT(2, 2);
    this.rtBlurA = makeRT(2, 2);
    this.rtBlurB = makeRT(2, 2);
    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadGeo = new THREE.PlaneGeometry(2, 2);
    this.brightMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: this.rtScene.texture } },
      vertexShader: QUAD_VERT, fragmentShader: BRIGHT_FRAG, depthTest: false, depthWrite: false
    });
    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(0, 0) } },
      vertexShader: QUAD_VERT, fragmentShader: BLUR_FRAG, depthTest: false, depthWrite: false
    });
    this.compMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.rtScene.texture },
        tBloom: { value: this.rtBlurB.texture },
        uResolution: { value: new THREE.Vector2(W, H) },
        uTime: { value: 0 }, uHit: { value: 0 }, uBloom: { value: 0.62 }
      },
      vertexShader: QUAD_VERT, fragmentShader: COMPOSITE_FRAG, depthTest: false, depthWrite: false
    });
    this.quad = new THREE.Mesh(this.quadGeo, this.compMat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  /** 场景道具：同 kit 本地 GLB，用 InstancedMesh 省 draw call */
  async buildProps() {
    const ids = GAME.models.props;
    const dummy = new THREE.Object3D();
    for (let k = 0; k < ids.length; k += 1) {
      const id = ids[k];
      const count = /house|gate/.test(id) ? 1 : 3;
      let mesh;
      try { mesh = await this.pool.createInstanced(id, count); }
      catch (_) { continue; }
      for (let i = 0; i < count; i += 1) {
        const a = (k * 2.1 + i * 2.7) % (Math.PI * 2);
        const r = /house|gate/.test(id) ? 34 : 12 + ((k * 7 + i * 11) % 22);
        const s = /house|gate/.test(id) ? 1 : 0.8 + ((k + i * 3) % 5) * 0.12;
        dummy.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        dummy.rotation.set(0, -a + Math.PI / 2 + (i * 0.7), 0);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      this.scene.add(mesh);
    }
  }

  setLevel(level) {
    const fog = level && level.twistAxis === "info" ? 0.030 : 0.019;
    this.scene.fog.density = fog;
    this.audioIntensity = Math.min(1, 0.25 + (level ? level.difficulty : 1) / 10);
  }

  setWeaponTint(color) { this.weaponTint = color; }

  /** 枪口火焰 / 命中火花 / 血雾，全部代码粒子 */
  burst(pos, color = 0xffa64d, amount = 12, spread = 2.2) {
    const c = new THREE.Color(color);
    for (let i = 0; i < amount; i += 1) {
      const j = this.pCursor++ % this.pCount;
      const k = j * 3;
      this.pPos[k] = pos.x; this.pPos[k + 1] = pos.y; this.pPos[k + 2] = pos.z;
      this.pVel[k] = (Math.random() - 0.5) * spread;
      this.pVel[k + 1] = Math.random() * spread * 0.7 + 0.3;
      this.pVel[k + 2] = (Math.random() - 0.5) * spread;
      this.pCol[k] = c.r; this.pCol[k + 1] = c.g; this.pCol[k + 2] = c.b;
      this.pLife[j] = 0.35 + Math.random() * 0.5;
    }
  }

  flashMuzzle() {
    this.muzzleLight.intensity = 7.5;
    this.muzzleT = 0.07;
  }

  flashDamage(strength = 1) { this.hitFlash = Math.max(this.hitFlash, strength); }

  /** 世界坐标 → 屏幕逻辑坐标（hitscan 与小地图共用） */
  project(vec3) {
    const v = vec3.clone().project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * W,
      y: (-v.y * 0.5 + 0.5) * H,
      z: v.z,
      visible: v.z > -1 && v.z < 1
    };
  }

  update(dt, player) {
    this.time += dt;
    this.skyMat.uniforms.uTime.value = this.time;
    if (this.time > this.nextFlash) {
      this.flash = 0.9;
      this.nextFlash = this.time + 9 + Math.random() * 16;
    }
    this.flash = Math.max(0, this.flash - dt * 2.6);
    this.skyMat.uniforms.uFlash.value = this.flash * (0.6 + Math.random() * 0.4);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 2.4);
    this.compMat.uniforms.uHit.value = this.hitFlash;
    this.compMat.uniforms.uTime.value = this.time;

    for (let i = 0; i < this.fireLights.length; i += 1) {
      const l = this.fireLights[i];
      l.intensity = 2.0 + Math.sin(this.time * (9 + i) + i) * 0.55 + Math.random() * 0.35;
    }
    if (this.muzzleT > 0) {
      this.muzzleT -= dt;
      this.muzzleLight.intensity = Math.max(0, this.muzzleT / 0.07) * 7.5;
    }

    // 相机：yaw 绕 Y，pitch 绕 X；yaw=0 面向 -Z（three 的默认）
    this.camera.position.set(player.x, player.eye, player.z);
    this.camera.rotation.y = player.yaw;
    this.camera.rotation.x = player.pitch;
    const targetFov = player.ads ? GAME.play.adsFov : GAME.play.hipFov;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 12);
    this.camera.updateProjectionMatrix();

    // 粒子
    let dirty = false;
    for (let i = 0; i < this.pCount; i += 1) {
      if (this.pLife[i] <= 0) continue;
      const k = i * 3;
      this.pLife[i] -= dt;
      this.pPos[k] += this.pVel[k] * dt;
      this.pPos[k + 1] += this.pVel[k + 1] * dt;
      this.pPos[k + 2] += this.pVel[k + 2] * dt;
      this.pVel[k + 1] -= 5.2 * dt;
      if (this.pLife[i] <= 0) this.pPos[k + 1] = -999;
      dirty = true;
    }
    if (dirty) {
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.color.needsUpdate = true;
    }
    // hitscan / 枪口火焰都发生在 render() 之前，必须先把相机与武器子树的
    // matrixWorld 推到本帧，否则投影用的是上一帧姿势（快速转向时打不中）。
    this.camera.updateMatrixWorld(true);
  }

  _pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  render() {
    const r = this.renderer;
    if (!this.post) {
      r.setRenderTarget(null);
      r.render(this.scene, this.camera);
      return;
    }
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(this.scene, this.camera);
    this.brightMat.uniforms.tDiffuse.value = this.rtScene.texture;
    this._pass(this.brightMat, this.rtBright);
    const w = this.rtBright.width, h = this.rtBright.height;
    this.blurMat.uniforms.tDiffuse.value = this.rtBright.texture;
    this.blurMat.uniforms.uDir.value.set(1.2 / w, 0);
    this._pass(this.blurMat, this.rtBlurA);
    this.blurMat.uniforms.tDiffuse.value = this.rtBlurA.texture;
    this.blurMat.uniforms.uDir.value.set(0, 1.2 / h);
    this._pass(this.blurMat, this.rtBlurB);
    this.compMat.uniforms.tDiffuse.value = this.rtScene.texture;
    this.compMat.uniforms.tBloom.value = this.rtBlurB.texture;
    this._pass(this.compMat, null);
  }

  /** canvas 后备像素倍数：设计分辨率 × 舞台缩放 × 设备像素比（4K 屏不发虚） */
  _pr() {
    return this.viewport.pixelRatio * Math.max(1, this.viewport.state.scale || 1);
  }

  resize() {
    const pr = this._pr();
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(W, H, false);
    // 舞台固定 1280×720：相机宽高比必须与设计坐标一致，HUD 与 3D 才逐像素对齐
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
    const w = Math.max(2, Math.round(W * pr));
    const h = Math.max(2, Math.round(H * pr));
    this.rtScene.setSize(w, h);
    this.rtBright.setSize(Math.max(2, w >> 1), Math.max(2, h >> 1));
    this.rtBlurA.setSize(Math.max(2, w >> 1), Math.max(2, h >> 1));
    this.rtBlurB.setSize(Math.max(2, w >> 1), Math.max(2, h >> 1));
    this.compMat.uniforms.uResolution.value.set(w, h);
  }
}
