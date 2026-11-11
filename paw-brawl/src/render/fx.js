import * as THREE from 'three';
import { CONFIG } from '../../config/game.config.js';

export function createFx(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const shadows = new Map();
  const particles = [];
  const rings = [];
  const flashes = [];
  const speedLines = [];
  const ghosts = [];
  const confetti = [];
  const particlePool = { spark: [], puff: [] };
  let quality = 'auto';
  let particleLimit = 180;
  let confettiLimit = 220;
  const confettiCanvas = document.createElement('canvas');
  confettiCanvas.id = 'confetti';
  Object.assign(confettiCanvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '23' });
  document.body.append(confettiCanvas);
  const confettiContext = confettiCanvas.getContext('2d');
  const circle = new THREE.CircleGeometry(CONFIG.fx.shadowRadius, 24);
  const puffGeometry = new THREE.SphereGeometry(CONFIG.fx.dustSize, 8, 6);
  const sparkGeometry = new THREE.SphereGeometry(0.075, 7, 5);
  const ringGeometry = new THREE.TorusGeometry(1, 0.045, 6, 48);
  const flashGeometry = new THREE.SphereGeometry(1, 16, 12);
  const lineGeometry = new THREE.BoxGeometry(0.035, 0.035, 1.2);
  const ghostGeometry = new THREE.SphereGeometry(1, 12, 8);
  const screenFlash = document.createElement('div');
  Object.assign(screenFlash.style, {
    position: 'fixed', inset: '0', background: '#FFFFFF', opacity: '0',
    pointerEvents: 'none', zIndex: '24',
  });
  document.body.append(screenFlash);
  let screenFlashT = 0;

  function addShadow(id) {
    const material = new THREE.MeshBasicMaterial({ color: '#51435E', transparent: true, opacity: CONFIG.fx.shadowOpacity, depthWrite: false, toneMapped: false });
    const mesh = new THREE.Mesh(circle, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 2;
    group.add(mesh);
    shadows.set(id, mesh);
    return mesh;
  }

  function removeShadow(id) {
    const shadow = shadows.get(id);
    if (!shadow) return;
    group.remove(shadow);
    shadow.material.dispose();
    shadows.delete(id);
  }

  function clearShadows() {
    for (const id of [...shadows.keys()]) removeShadow(id);
  }

  function clearEffects() {
    while (particles.length) releaseParticle(particles.pop());
    for (const list of [rings, flashes, speedLines]) {
      for (const entry of list) {
        group.remove(entry.mesh);
        entry.mesh.material.dispose();
      }
      list.length = 0;
    }
    for (const ghost of ghosts) {
      group.remove(ghost.group);
      ghost.material.dispose();
    }
    ghosts.length = 0;
    confetti.length = 0;
    screenFlashT = 0;
    screenFlash.style.opacity = '0';
  }

  function updateShadow(id, x, y, z, visible = true) {
    const shadow = shadows.get(id);
    if (!shadow) return;
    shadow.visible = visible;
    shadow.position.set(x, CONFIG.fx.shadowLift, z);
    const scale = 1 / (1 + Math.max(0, y) * 0.32);
    shadow.scale.setScalar(scale);
    shadow.material.opacity = CONFIG.fx.shadowOpacity * scale;
  }

  function releaseParticle(entry) {
    group.remove(entry.mesh);
    particlePool[entry.poolKey].push(entry.mesh);
  }

  function particle(x, y, z, { color = '#FFF0D7', size = 1, life = CONFIG.fx.dustLife, speed = CONFIG.fx.dustSpeed, rise = CONFIG.fx.dustRise, angle = 0, gravity = CONFIG.fx.dustGravity, spark = false } = {}) {
    if (particles.length >= particleLimit) releaseParticle(particles.shift());
    const poolKey = spark ? 'spark' : 'puff';
    let mesh = particlePool[poolKey].pop();
    if (!mesh) {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false });
      mesh = new THREE.Mesh(spark ? sparkGeometry : puffGeometry, material);
    }
    mesh.material.color.set(color);
    mesh.material.opacity = 0.8;
    mesh.position.set(x, y, z);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.setScalar(size);
    group.add(mesh);
    particles.push({ mesh, poolKey, life, maxLife: life, vx: Math.sin(angle) * speed, vy: rise, vz: Math.cos(angle) * speed, gravity, spin: (Math.random() - 0.5) * 8 });
  }

  function spawnDust(x, y, z) {
    const count = quality === 'low' ? Math.ceil(CONFIG.fx.dustCount / 2) : CONFIG.fx.dustCount;
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count + Math.random() * 0.25;
      particle(x, y + 0.08, z, { angle, rise: CONFIG.fx.dustRise * (0.7 + Math.random() * 0.3) });
    }
  }

  function shockRing(x, y, z, from, to, life = 0.22, opacity = 0.7, color = '#FFFFFF') {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest: false, toneMapped: false });
    const mesh = new THREE.Mesh(ringGeometry, material);
    mesh.renderOrder = 19;
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(from);
    group.add(mesh);
    rings.push({ mesh, life, maxLife: life, from, to, opacity });
  }

  function spawnHit(x, y, z, heavy = false, direction = { x: 0, z: 1 }) {
    // 命中闪光：加法混合的小球，不要盖住角色（M6 实测白色实心球会糊成一坨）
    const flashMaterial = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.6, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, toneMapped: false });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    const flashRadius = heavy ? 0.62 : 0.42;
    flash.renderOrder = 20;
    flash.position.set(x, y, z);
    flash.scale.setScalar(flashRadius * 0.6);
    group.add(flash);
    flashes.push({ mesh: flash, radius: flashRadius, life: 0.07, maxLife: 0.07 });
    screenFlashT = 0.06;
    if (heavy) shockRing(x, y, z, 0.4, 2, 0.25, 0.9, '#FFF0D7');

    const count = quality === 'low' ? (heavy ? 14 : 8) : (heavy ? 28 : 16);
    for (let i = 0; i < count; i++) {
      particle(x, y, z, {
        color: i % 3 === 0 ? '#FFFFFF' : heavy ? '#FF7A59' : '#FFD166',
        angle: i * Math.PI * 2 / count + Math.random() * 0.35,
        speed: (heavy ? 3.8 : 2.5) * 1.4 * 1.6 * (0.7 + Math.random() * 0.3),
        rise: 0.8 + Math.random() * 2,
        gravity: 5,
        life: 0.4,
        size: heavy ? 1.25 : 0.8,
        spark: true,
      });
    }
    const length = Math.hypot(direction.x, direction.z) || 1;
    const dx = direction.x / length;
    const dz = direction.z / length;
    for (let i = 0; i < 4; i++) {
      const material = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.85, depthWrite: false, depthTest: false, toneMapped: false });
      const mesh = new THREE.Mesh(lineGeometry, material);
      mesh.renderOrder = 20;
      mesh.position.set(x + (i - 1.5) * dz * 0.14, y + (i - 1.5) * 0.12, z - (i - 1.5) * dx * 0.14);
      mesh.rotation.y = Math.atan2(dx, dz);
      group.add(mesh);
      speedLines.push({ mesh, life: 0.18, maxLife: 0.18, vx: dx * (8 + i), vy: 0.5 + i * 0.2, vz: dz * (8 + i) });
    }
  }

  function spawnGhost(position, character, scale, facing) {
    const limit = 6;
    if (ghosts.length >= limit) {
      const oldest = ghosts.shift();
      group.remove(oldest.group);
      oldest.material.dispose();
    }
    const material = new THREE.MeshBasicMaterial({ color: character.colors.fur, transparent: true, opacity: 0.2, depthWrite: false, toneMapped: false });
    const ghost = new THREE.Group();
    ghost.position.set(position.x, position.y, position.z);
    ghost.rotation.y = facing;
    ghost.scale.setScalar(scale);
    const body = new THREE.Mesh(ghostGeometry, material);
    body.position.y = 0.61;
    body.scale.set(character.build.body, character.build.body * 0.92, character.build.body * 0.84);
    const head = new THREE.Mesh(ghostGeometry, material);
    head.position.set(0, 1.2, 0.06);
    head.scale.set(character.build.head, character.build.head * 0.96, character.build.head * 0.94);
    ghost.add(body, head);
    group.add(ghost);
    ghosts.push({ group: ghost, material, life: 0.25, maxLife: 0.25 });
  }

  function spawnSlam(x, z, range = 2.2) {
    spawnDust(x, 0, z);
    shockRing(x, 0.07, z, 0.4, Math.max(2.6, range), 0.22, 0.7);
  }

  function spawnKO(x, y, z) {
    const count = quality === 'low' ? 8 : 16;
    for (let i = 0; i < count; i++) {
      particle(x, Math.max(0.5, y + 1), z, {
        color: ['#FF7A59', '#FFD166', '#7EE0C0', '#8FD3FF'][i % 4],
        angle: i * Math.PI * 2 / count,
        speed: 2.2 + Math.random() * 2,
        rise: 3 + Math.random() * 2,
        gravity: 5,
        life: 0.8,
        spark: true,
      });
    }
  }

  function spawnConfetti() {
    const count = quality === 'low' ? 60 : 120;
    for (let i = 0; i < count; i++) {
      confetti.push({
        x: Math.random() * window.innerWidth,
        y: -20 - Math.random() * window.innerHeight * 0.35,
        vx: (Math.random() - 0.5) * 90,
        vy: 70 + Math.random() * 110,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 9,
        size: 4 + Math.random() * 6,
        life: 3 + Math.random() * 2,
        color: ['#FF7A59', '#FFD166', '#7EE0C0', '#8FD3FF', '#F2B8D0'][i % 5],
      });
    }
    if (confetti.length > confettiLimit) confetti.splice(0, confetti.length - confettiLimit);
  }

  function updateConfetti(dt) {
    const dpr = quality === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (confettiCanvas.width !== Math.round(width * dpr) || confettiCanvas.height !== Math.round(height * dpr)) {
      confettiCanvas.width = Math.round(width * dpr);
      confettiCanvas.height = Math.round(height * dpr);
    }
    confettiContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    confettiContext.clearRect(0, 0, width, height);
    for (let i = confetti.length - 1; i >= 0; i--) {
      const piece = confetti[i];
      piece.life -= dt;
      if (piece.life <= 0 || piece.y > height + 30) {
        confetti.splice(i, 1);
        continue;
      }
      piece.x += piece.vx * dt;
      piece.y += piece.vy * dt;
      piece.vy += 35 * dt;
      piece.rotation += piece.spin * dt;
      confettiContext.save();
      confettiContext.translate(piece.x, piece.y);
      confettiContext.rotate(piece.rotation);
      confettiContext.globalAlpha = Math.min(1, piece.life);
      confettiContext.fillStyle = piece.color;
      confettiContext.fillRect(-piece.size * 0.5, -piece.size * 0.3, piece.size, piece.size * 0.6);
      confettiContext.restore();
    }
  }

  function update(dt) {
    updateConfetti(dt);
    screenFlashT = Math.max(0, screenFlashT - dt);
    screenFlash.style.opacity = String(screenFlashT / 0.06 * 0.18);
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.life -= dt;
      if (particle.life <= 0) {
        releaseParticle(particle);
        particles.splice(i, 1);
        continue;
      }
      particle.vy -= particle.gravity * dt;
      particle.mesh.position.x += particle.vx * dt;
      particle.mesh.position.y += particle.vy * dt;
      particle.mesh.position.z += particle.vz * dt;
      particle.mesh.rotation.x += particle.spin * dt;
      particle.mesh.rotation.z += particle.spin * 0.7 * dt;
      const progress = 1 - particle.life / particle.maxLife;
      particle.mesh.scale.multiplyScalar(1 + dt * 1.8);
      particle.mesh.material.opacity = (1 - progress) * 0.8;
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const ring = rings[i];
      ring.life -= dt;
      if (ring.life <= 0) {
        group.remove(ring.mesh);
        ring.mesh.material.dispose();
        rings.splice(i, 1);
        continue;
      }
      const progress = 1 - ring.life / ring.maxLife;
      ring.mesh.scale.setScalar(ring.from + progress * (ring.to - ring.from));
      ring.mesh.material.opacity = (1 - progress) * ring.opacity;
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const flash = flashes[i];
      flash.life -= dt;
      if (flash.life <= 0) {
        group.remove(flash.mesh);
        flash.mesh.material.dispose();
        flashes.splice(i, 1);
        continue;
      }
      const progress = 1 - flash.life / flash.maxLife;
      flash.mesh.scale.setScalar(flash.radius * (0.65 + progress * 0.35));
      flash.mesh.material.opacity = (1 - progress) * 0.6;
    }
    for (let i = speedLines.length - 1; i >= 0; i--) {
      const line = speedLines[i];
      line.life -= dt;
      if (line.life <= 0) {
        group.remove(line.mesh);
        line.mesh.material.dispose();
        speedLines.splice(i, 1);
        continue;
      }
      line.mesh.position.x += line.vx * dt;
      line.mesh.position.y += line.vy * dt;
      line.mesh.position.z += line.vz * dt;
      line.mesh.material.opacity = line.life / line.maxLife * 0.85;
    }
    for (let i = ghosts.length - 1; i >= 0; i--) {
      const ghost = ghosts[i];
      ghost.life -= dt;
      if (ghost.life <= 0) {
        group.remove(ghost.group);
        ghost.material.dispose();
        ghosts.splice(i, 1);
        continue;
      }
      ghost.material.opacity = ghost.life / ghost.maxLife * 0.2;
    }
  }

  function setQuality(next) {
    quality = next === 'low' ? 'low' : 'auto';
    particleLimit = quality === 'low' ? 80 : 180;
    confettiLimit = quality === 'low' ? 110 : 220;
    while (particles.length > particleLimit) releaseParticle(particles.shift());
    if (confetti.length > confettiLimit) confetti.splice(0, confetti.length - confettiLimit);
  }

  return { group, addShadow, removeShadow, clearShadows, clearEffects, updateShadow, spawnDust, spawnHit, spawnGhost, spawnSlam, spawnKO, spawnConfetti, update, setQuality, get confettiCount() { return confetti.length; } };
}
