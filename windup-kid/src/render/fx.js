// 打击特效：木屑 / 尘团 / 冲击环 / 星芒。全部用 Canvas 贴图，零外部资产。
import * as THREE from 'three';

function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const chipTex = () => canvasTex(64, (ctx, s) => {
  ctx.translate(s / 2, s / 2);
  ctx.fillStyle = '#d9a25a';
  ctx.strokeStyle = '#8a5a2c';
  ctx.lineWidth = s * 0.08;
  ctx.beginPath();
  ctx.roundRect(-s * 0.34, -s * 0.16, s * 0.68, s * 0.32, s * 0.1);
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(120,75,35,.55)';
  ctx.lineWidth = s * 0.03;
  ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.04); ctx.lineTo(s * 0.2, -s * 0.04); ctx.stroke();
});

const puffTex = () => canvasTex(64, (ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(236,214,178,.9)');
  g.addColorStop(0.55, 'rgba(214,186,148,.45)');
  g.addColorStop(1, 'rgba(200,170,130,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
});

const ringTex = () => canvasTex(128, (ctx, s) => {
  ctx.translate(s / 2, s / 2);
  // 外深内亮：亮天空和暗地面都能看清
  ctx.strokeStyle = 'rgba(66,38,16,.92)';
  ctx.lineWidth = s * 0.17;
  ctx.beginPath(); ctx.arc(0, 0, s * 0.33, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,228,158,1)';
  ctx.lineWidth = s * 0.08;
  ctx.beginPath(); ctx.arc(0, 0, s * 0.33, 0, Math.PI * 2); ctx.stroke();
});

const starTex = () => canvasTex(128, (ctx, s) => {
  ctx.translate(s / 2, s / 2);
  ctx.fillStyle = 'rgba(255,235,180,.95)';
  ctx.beginPath();
  const R = s * 0.46, r = s * 0.12;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? R : r;
    if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
});

export function createFx(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const texChip = chipTex();
  const texPuff = puffTex();
  const texRing = ringTex();
  const texStar = starTex();

  const chips = [];
  const puffs = [];
  const rings = [];
  const stars = [];

  let dustCount = 0;

  function dust(x, y) {
    dustCount++;
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: texPuff, transparent: true, depthWrite: false, depthTest: false, opacity: 0.7 }),
      );
      sp.material.toneMapped = false;
      sp.material.color.set(0xf2ddb4);
      sp.position.set(x + (Math.random() - 0.5) * 0.18, y + 0.04, 0.6);
      sp.scale.setScalar(0.22 + Math.random() * 0.12);
      sp.renderOrder = 9;
      group.add(sp);
      puffs.push({ sp, life: 0.22 + Math.random() * 0.1, max: 0.32, vx: (Math.random() - 0.5) * 0.5, vy: 0.35 });
    }
  }

  function spawn(x, y) {
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(0.32, 0.17),
        new THREE.MeshBasicMaterial({ map: texChip, transparent: true, depthWrite: false, depthTest: false }),
      );
      m.material.toneMapped = false;
      m.position.set(x + (Math.random() - 0.5) * 0.34, y + Math.random() * 0.18, 0.6);
      m.rotation.z = Math.random() * Math.PI;
      m.renderOrder = 10;
      group.add(m);
      chips.push({
        m, life: 0.55 + Math.random() * 0.25, max: 0.8,
        vx: (Math.random() - 0.5) * 5.4, vy: 2.6 + Math.random() * 4.8,
        spin: (Math.random() - 0.5) * 14,
      });
    }
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: texPuff, transparent: true, depthWrite: false, depthTest: false, opacity: 0.8 }),
      );
      sp.material.toneMapped = false;
      sp.material.color.set(0xffe9c8);
      sp.position.set(x + (Math.random() - 0.5) * 0.55, y + (Math.random() - 0.3) * 0.3, 0.58);
      sp.scale.setScalar(0.5 + Math.random() * 0.35);
      sp.renderOrder = 10;
      group.add(sp);
      puffs.push({ sp, life: 0.32 + Math.random() * 0.2, max: 0.5, vx: (Math.random() - 0.5) * 1.4, vy: 0.8 + Math.random() });
    }

    const ring = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.2),
      new THREE.MeshBasicMaterial({ map: texRing, transparent: true, depthWrite: false, depthTest: false, color: 0xffe0a0 }),
    );
    ring.material.toneMapped = false;
    ring.position.set(x, y, 0.62);
    ring.renderOrder = 10;
    group.add(ring);
    rings.push({ m: ring, life: 0.28, max: 0.28 });

    const star = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: texStar, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }),
    );
    star.material.toneMapped = false;
    star.position.set(x, y, 0.64);
    star.scale.setScalar(1.3);
    star.renderOrder = 10;
    group.add(star);
    stars.push({ sp: star, life: 0.18, max: 0.18 });
  }

  function update(dt) {
    for (let i = chips.length - 1; i >= 0; i--) {
      const p = chips[i];
      p.life -= dt;
      if (p.life <= 0) { group.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); chips.splice(i, 1); continue; }
      p.vy -= 13 * dt;
      p.m.position.x += p.vx * dt;
      p.m.position.y += p.vy * dt;
      p.m.rotation.z += p.spin * dt;
      p.m.material.opacity = Math.min(1, p.life / 0.25);
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.life -= dt;
      if (p.life <= 0) { group.remove(p.sp); p.sp.geometry.dispose(); p.sp.material.dispose(); puffs.splice(i, 1); continue; }
      p.sp.position.x += p.vx * dt;
      p.sp.position.y += p.vy * dt;
      p.sp.scale.multiplyScalar(1 + dt * 3.4);
      p.sp.material.opacity = 0.75 * (p.life / p.max);
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.life -= dt;
      if (r.life <= 0) { group.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); rings.splice(i, 1); continue; }
      const k = 1 - r.life / r.max;
      r.m.scale.setScalar(0.6 + k * 5.2);
      r.m.material.opacity = 1 - k;
    }
    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i];
      s.life -= dt;
      if (s.life <= 0) { group.remove(s.sp); s.sp.geometry.dispose(); s.sp.material.dispose(); stars.splice(i, 1); continue; }
      const k = 1 - s.life / s.max;
      s.sp.scale.setScalar(0.9 + k * 0.8);
      s.sp.material.opacity = 1 - k;
    }
  }

  function clear() {
    for (const p of chips) { group.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); }
    for (const p of puffs) { group.remove(p.sp); p.sp.geometry.dispose(); p.sp.material.dispose(); }
    for (const r of rings) { group.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); }
    for (const s of stars) { group.remove(s.sp); s.sp.geometry.dispose(); s.sp.material.dispose(); }
    chips.length = 0; puffs.length = 0; rings.length = 0; stars.length = 0;
  }

  return { group, spawn, dust, update, clear, get dustCount() { return dustCount; } };
}
