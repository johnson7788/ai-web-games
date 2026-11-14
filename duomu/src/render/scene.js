/**
 * 场景渲染。只读 run 状态 + 自己的动画缓存，绝不回写规则层。
 *
 * 坐标一律用 720×1280 的逻辑世界，缩放由 main.js 通过 ctx.setTransform 处理。
 */
import { WORLD, LAYOUT, ACTS, MATCH, PALETTE, AI_LEVELS } from '../../config/game.config.js';
import { SIDE, tierAt, actConfig } from '../game/rules.js';
import { IMG } from './assets.js';
import { t } from '../core/i18n.js';

const CN_FONT = '"Noto Sans SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';

const GROUND_Y = LAYOUT.groundY;                     // 1120
const TREE_BOTTOM = GROUND_Y;
const SEG_H = LAYOUT.segH;                           // 172
const SEG_GAP = LAYOUT.segGap;                       // 4
const SEG_STEP = SEG_H + SEG_GAP;
const TRUNK_W = LAYOUT.trunkW;                       // 456
const TRUNK_X = LAYOUT.trunkX - TRUNK_W / 2;
const SCENE_TOP = LAYOUT.sceneTop;
const SPRING_K = 260;   // 回弹刚度（rad/s²）
const SPRING_C = 22;    // 阻尼

function font(size, weight = 'bold') { return `${weight} ${size}px ${CN_FONT}`; }

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function lerp(a, b, k) { return a + (b - a) * k; }
function easeOut(k) { return 1 - Math.pow(1 - k, 3); }

/** 木段在屏幕上的竖向位置（0 = 最下面那一节） */
function segY(index, dropOffset) {
  return TREE_BOTTOM - (index + 1) * SEG_STEP + dropOffset;
}

export class Scene {
  constructor(ctx, dpr = 1) {
    this.ctx = ctx;
    this.dpr = dpr;
    this.cache = Object.create(null);
    this.t = 0;
    this.shake = 0;
    this.flash = 0;
    this.flashColor = '#fff';
    this.dropOffset = 0;        // 砍掉一节后整棵树下坠的位移
    this.dropVel = 0;
    this.particles = [];
    this.floaters = [];
    this.bolts = [];
    this.flying = [];           // 被砍飞的木段
    this.heroAnim = [{ pose: 'idle', until: 0 }, { pose: 'idle', until: 0 }];
    this.lastSegId = -1;
    this.segPop = 0;            // 新木段落地的弹入
    this.comboGlow = [0, 0];
  }

  /**
   * 把原图预缩放到「实际绘制像素尺寸 × dpr」并缓存。
   * 之后每帧都是 1:1 blit —— 软件渲染下这是最大的一笔性能账。
   */
  prep(key, w, h) {
    const id = `${key}@${w}x${h}@${this.dpr}`;
    let c = this.cache[id];
    if (c) return c;
    const img = IMG[key];
    if (!img) return null;
    c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * this.dpr));
    c.height = Math.max(1, Math.round(h * this.dpr));
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, c.width, c.height);
    this.cache[id] = c;
    return c;
  }

  /* ───────────── 事件 → 视觉 ───────────── */

  onEvents(events, run) {
    for (const e of events) {
      switch (e.type) {
        case 'chop': {
          const side = e.side;
          this.heroAnim[e.player] = { pose: 'strike', until: this.t + 260 };
          this.dropOffset = SEG_STEP;
          this.dropVel = -SEG_STEP * 6;
          this.spawnFlying(e.side, e.player);
          this.shake = Math.max(this.shake, e.tier === 'blind' ? 12 : 7);
          this.flash = Math.max(this.flash, 0.22);
          this.flashColor = '#ffe6a8';
          this.burstWood(side, e.tier === 'blind' ? 16 : 10);
          this.pushFloater({
            text: '+' + e.gain, sub: e.tier === 'blind' ? t('toast.blind') : e.tier === 'hint' ? t('toast.hint') : '',
            x: side === SIDE.L ? 108 : 612, y: TREE_BOTTOM - SEG_H - 120,
            born: this.t, color: e.tier === 'blind' ? PALETTE.gold : e.tier === 'hint' ? PALETTE.fire : PALETTE.paper,
            player: e.player,
          });
          this.comboGlow[e.player] = 1;
          break;
        }
        case 'zap': {
          this.heroAnim[e.player] = { pose: 'dead', until: this.t + 520 };
          this.bolt(e.player, true);
          this.shake = 22;
          this.flash = 0.32;
          this.flashColor = '#ffd0b0';
          this.burstEmber(e.side);
          this.pushFloater({
            text: t('toast.zap'), sub: '', x: e.player === 0 ? 132 : 588, y: TREE_BOTTOM - 340,
            born: this.t, color: '#ff9a6a', player: -1,
          });
          break;
        }
        case 'smite': {
          this.heroAnim[e.player] = { pose: 'dead', until: this.t + 520 };
          this.bolt(e.player, false);
          this.shake = 26;
          this.flash = 0.38;
          this.flashColor = '#c9a8ff';
          this.pushFloater({
            text: t('toast.smite'), sub: '', x: e.player === 0 ? 200 : 520, y: TREE_BOTTOM - 300,
            born: this.t, color: '#c9a8ff', player: -1,
          });
          break;
        }
        case 'escape': {
          this.pushFloater({
            text: t('toast.escape'), sub: '', x: 360, y: TREE_BOTTOM - 210,
            born: this.t, color: '#9aa4bb', player: -1,
          });
          break;
        }
        case 'hint':
          this.segPop = 1;
          break;
        case 'reveal':
          this.shake = Math.max(this.shake, 5);
          break;
        case 'act':
        case 'sudden':
          this.flash = 0.4;
          this.flashColor = '#ffffff';
          break;
        default:
          break;
      }
    }
  }

  /** 木段被砍飞：朝出手者的反方向甩出去 */
  spawnFlying(side) {
    this.flying.push({
      dir: side === SIDE.L ? 1 : -1,
      born: this.t, x: 360, y: TREE_BOTTOM - SEG_H * 0.4,
      rot: 0, vx: 900, vy: -420,
    });
  }

  bolt(player, isZap) {
    const x = player === 0 ? LAYOUT.heroLeftX : LAYOUT.heroRightX;
    const pts = [];
    const topY = -40;
    let y = topY;
    let cx = x + (Math.random() * 90 - 45);
    while (y < GROUND_Y - 120) {
      pts.push([cx, y]);
      y += 60 + Math.random() * 70;
      cx += (Math.random() * 2 - 1) * 46;
    }
    pts.push([x, GROUND_Y - 120]);
    this.bolts.push({ pts, born: this.t, life: isZap ? 260 : 420, strong: !isZap });
  }

  /** 飘字入栈时错开，避免几条压在一起 */
  pushFloater(f) {
    let stack = 0;
    for (const g of this.floaters) {
      if (Math.abs(g.x - f.x) < 180 && this.t - g.born < 420) stack += 1;
    }
    f.y -= stack * 46;
    this.floaters.push(f);
  }

  burstWood(side, n) {
    const ox = side === SIDE.L ? TRUNK_X + 40 : TRUNK_X + TRUNK_W - 40;
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: ox, y: TREE_BOTTOM - SEG_H * 0.55,
        vx: (side === SIDE.L ? 1 : -1) * (60 + Math.random() * 420),
        vy: -120 - Math.random() * 380,
        life: 480 + Math.random() * 380, born: this.t,
        size: 3 + Math.random() * 7,
        color: Math.random() < 0.3 ? '#f0c471' : '#8a5a32',
        grav: 1500,
      });
    }
  }

  burstEmber(side) {
    const ox = side === SIDE.L ? TRUNK_X + 30 : TRUNK_X + TRUNK_W - 30;
    for (let i = 0; i < 22; i++) {
      this.particles.push({
        x: ox + (Math.random() * 80 - 40), y: TREE_BOTTOM - SEG_H * (0.3 + Math.random() * 0.5),
        vx: (Math.random() * 2 - 1) * 260, vy: -80 - Math.random() * 300,
        life: 420 + Math.random() * 500, born: this.t,
        size: 2 + Math.random() * 5,
        color: Math.random() < 0.5 ? '#ffd27a' : '#ff7a3c',
        grav: 700,
      });
    }
  }

  /* ───────────── 每帧推进 ───────────── */

  update(dt, run) {
    if (run.segs[0] && run.segs[0].id !== this.lastSegId) {
      this.lastSegId = run.segs[0].id;
      this.segPop = 1;
    }
    this.t += dt;
    this.shake *= Math.pow(0.0025, dt / 1000);
    this.flash *= Math.pow(0.0008, dt / 1000);
    this.segPop *= Math.pow(0.0006, dt / 1000);
    this.comboGlow = this.comboGlow.map((v) => v * Math.pow(0.02, dt / 1000));

    // 下坠回弹：标准阻尼弹簧，全部按「秒」算，避免帧率一变就发散
    const sec = dt / 1000;
    const acc = -SPRING_K * this.dropOffset - SPRING_C * this.dropVel;
    this.dropVel += acc * sec;
    this.dropOffset += this.dropVel * sec;
    if (Math.abs(this.dropOffset) < 0.4 && Math.abs(this.dropVel) < 6) { this.dropOffset = 0; this.dropVel = 0; }

    for (const p of this.particles) {
      p.vy += (p.grav * dt) / 1000;
      p.x += (p.vx * dt) / 1000;
      p.y += (p.vy * dt) / 1000;
    }
    this.particles = this.particles.filter((p) => this.t - p.born < p.life);
    this.floaters = this.floaters.filter((f) => this.t - f.born < 900);
    this.bolts = this.bolts.filter((b) => this.t - b.born < b.life);
    for (const f of this.flying) {
      f.vy += (900 * dt) / 1000;
      f.x += (f.vx * f.dir * dt) / 1000;
      f.y += (f.vy * dt) / 1000;
      f.rot += (dt / 1000) * 6 * f.dir;
    }
    this.flying = this.flying.filter((f) => f.y < WORLD.H + 400);
  }

  /* ───────────── 绘制 ───────────── */

  /** 只在菜单/说明页用：背景 + 顶栏渐隐，不画树和角色 */
  drawBackdropOnly(actIndex) {
    this.drawBackground(actIndex);
  }

  drawFrame(run, actIndex, now, showActors = true) {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0.4) {
      ctx.translate((Math.random() * 2 - 1) * this.shake * 0.5, (Math.random() * 2 - 1) * this.shake * 0.5);
    }
    this.drawBackground(actIndex);
    this.drawTree(run, now);
    this.drawFlying();
    if (showActors) this.drawHeroes(run);
    this.drawParticles();
    this.drawBolts();
    ctx.restore();
    if (this.flash > 0.01) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.6, this.flash);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, WORLD.W, WORLD.H);
      ctx.restore();
    }
    this.drawFloaters();
  }

  /**
   * 背景 + 静态压暗层一次性烘焙成一张位图。
   * 每帧只做一次全屏 blit —— 软件渲染下这是省帧的关键。
   */
  buildBackdrop(actIndex) {
    const id = 'backdrop:' + actIndex + '@' + this.dpr;
    if (this.cache[id]) return this.cache[id];
    const c = document.createElement('canvas');
    c.width = Math.round(WORLD.W * this.dpr);
    c.height = Math.round(WORLD.H * this.dpr);
    const g = c.getContext('2d');
    g.scale(this.dpr, this.dpr);
    g.imageSmoothingQuality = 'high';

    const key = ACTS[Math.min(actIndex, ACTS.length - 1)].bg;
    if (IMG[key]) {
      g.drawImage(IMG[key], 0, 0, WORLD.W, WORLD.H);
    } else {
      const base = g.createLinearGradient(0, 0, 0, WORLD.H);
      base.addColorStop(0, '#141225');
      base.addColorStop(1, '#2a2340');
      g.fillStyle = base;
      g.fillRect(0, 0, WORLD.W, WORLD.H);
    }

    const side = g.createLinearGradient(0, 0, WORLD.W, 0);
    side.addColorStop(0, 'rgba(4,3,8,0.62)');
    side.addColorStop(0.24, 'rgba(4,3,8,0.0)');
    side.addColorStop(0.5, 'rgba(4,3,8,0.28)');
    side.addColorStop(0.76, 'rgba(4,3,8,0.0)');
    side.addColorStop(1, 'rgba(4,3,8,0.62)');
    g.fillStyle = side;
    g.fillRect(0, 0, WORLD.W, WORLD.H);

    const ground = g.createLinearGradient(0, GROUND_Y - 40, 0, WORLD.H);
    ground.addColorStop(0, 'rgba(20,14,12,0.0)');
    ground.addColorStop(0.32, 'rgba(12,9,8,0.9)');
    ground.addColorStop(1, 'rgba(6,5,5,0.99)');
    g.fillStyle = ground;
    g.fillRect(0, GROUND_Y - 40, WORLD.W, WORLD.H - GROUND_Y + 40);

    const vig = g.createRadialGradient(WORLD.W / 2, WORLD.H * 0.46, WORLD.H * 0.30, WORLD.W / 2, WORLD.H * 0.46, WORLD.H * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.66)');
    g.fillStyle = vig;
    g.fillRect(0, 0, WORLD.W, WORLD.H);

    this.cache[id] = c;
    return c;
  }

  drawBackground(actIndex) {
    const ctx = this.ctx;
    const c = this.buildBackdrop(actIndex);
    ctx.drawImage(c, 0, 0, WORLD.W, WORLD.H);
  }

  drawTree(run, now) {
    const ctx = this.ctx;
    const segs = run.segs;
    const active = segs[0];
    const cfg = actConfig(run);
    const body = IMG.log_body;
    const face = IMG.log;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, SCENE_TOP, WORLD.W, GROUND_Y - SCENE_TOP + 10);
    ctx.clip();

    // 1) 树干：优先用整根竖版贴图（一次贴满，零接缝）
    if (IMG.trunk) {
      const th = GROUND_Y - SCENE_TOP + 40;
      const trunk = this.prep('trunk', TRUNK_W, th);
      if (trunk) ctx.drawImage(trunk, TRUNK_X, SCENE_TOP - 30, TRUNK_W, th);
    } else if (body) {
      const tileH = Math.max(40, Math.round((TRUNK_W * body.height) / body.width));
      const tile = this.prep('log_body', TRUNK_W, tileH);
      if (tile) {
        let y = GROUND_Y - 60;
        let guard = 0;
        while (y > SCENE_TOP - tileH && guard++ < 24) {
          y -= tileH;
          ctx.drawImage(tile, TRUNK_X, y, TRUNK_W, tileH);
        }
      }
    }

    // 2) 底部那节的锯切面
    const stumpH = face ? Math.round((TRUNK_W * face.height) / face.width) : SEG_H;
    if (face) {
      const pop = 1 - this.segPop * 0.1;
      const sh = stumpH * pop;
      const prepared = this.prep('log', TRUNK_W, stumpH);
      if (prepared) ctx.drawImage(prepared, TRUNK_X, GROUND_Y - sh, TRUNK_W, sh);
    }

    // 3) 当前木段的高亮框 + 雷印 + 倒计时
    if (active) {
      const y = GROUND_Y - stumpH;
      const pulse = 0.26 + Math.sin(this.t / 300) * 0.1;
      ctx.strokeStyle = `rgba(232,180,74,${pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(TRUNK_X + 2, y - 24);
      ctx.lineTo(TRUNK_X + 2, y + stumpH + 8);
      ctx.lineTo(TRUNK_X + TRUNK_W - 2, y + stumpH + 8);
      ctx.lineTo(TRUNK_X + TRUNK_W - 2, y - 24);
      ctx.stroke();

      if (active.state === 'hint' && active.brand !== SIDE.BOTH) this.drawHintGlow(active.hint, y, stumpH);
      if (active.state === 'revealed' || active.state === 'done') {
        if (active.brand === SIDE.L || active.brand === SIDE.BOTH) this.drawRune('L', y, stumpH);
        if (active.brand === SIDE.R || active.brand === SIDE.BOTH) this.drawRune('R', y, stumpH);
      }
      for (let p = 0; p < 2; p++) {
        if (!active.chopped[p]) continue;
        const px = p === 0 ? TRUNK_X + 26 : TRUNK_X + TRUNK_W - 26;
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = p === 0 ? PALETTE.red : PALETTE.cyan;
        ctx.beginPath();
        ctx.arc(px, y + 22, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      this.drawTimingStrip(active, y - 4, cfg, now);
    }

    ctx.restore();
  }

  drawHintGlow(side, stumpY, stumpH = SEG_H) {
    const ctx = this.ctx;
    const x = side === SIDE.L ? TRUNK_X + 20 : TRUNK_X + TRUNK_W - 20;
    const cy = stumpY + stumpH * 0.62;
    const r = Math.max(70, stumpH * 0.95);
    const pulse = 0.55 + Math.sin(this.t / 90) * 0.25;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, cy, 4, x, cy, r);
    g.addColorStop(0, `rgba(255,206,110,${0.5 * pulse})`);
    g.addColorStop(0.45, `rgba(255,140,50,${0.2 * pulse})`);
    g.addColorStop(1, 'rgba(255,110,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  /** 雷印：烙在当前木段的左/右边缘，黑底走加色混合 */
  drawRune(side, stumpY, stumpH = SEG_H) {
    const ctx = this.ctx;
    const size = Math.max(90, Math.min(180, stumpH * 1.55));
    const cx = side === SIDE.L ? TRUNK_X + size * 0.34 : TRUNK_X + TRUNK_W - size * 0.34;
    const cy = stumpY + stumpH * 0.6;
    const img = IMG.rune;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (img) {
      ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
    } else {
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 三段时间窗：贴在当前木段下沿，一眼看懂还剩多少便宜可占 */
  drawTimingStrip(seg, y, cfg, now) {
    const ctx = this.ctx;
    const w = TRUNK_W - 24;
    const x = TRUNK_X + 12;
    const by = y - 30;
    const bh = 20;
    const total = Math.max(1, seg.idleAt - seg.activeAt);
    const h1 = (cfg.hintMs / total) * w;
    const h2 = (cfg.revealMs / total) * w;

    ctx.save();
    ctx.globalAlpha = 0.9;
    roundRect(ctx, x, by, w, bh, 6);
    ctx.fillStyle = 'rgba(10,8,12,0.85)';
    ctx.fill();

    ctx.save();
    roundRect(ctx, x, by, w, bh, 6);
    ctx.clip();
    ctx.fillStyle = 'rgba(232,180,74,0.85)';
    ctx.fillRect(x, by, h1, bh);
    ctx.fillStyle = 'rgba(226,120,60,0.8)';
    ctx.fillRect(x + h1, by, h2, bh);
    ctx.fillStyle = 'rgba(180,200,220,0.45)';
    ctx.fillRect(x + h1 + h2, by, w - h1 - h2, bh);
    ctx.restore();

    // 三段各自的值
    const marks = [
      { cx: x + h1 / 2, label: '×' + MATCH.score.blind },
      { cx: x + h1 + h2 / 2, label: '×' + MATCH.score.hint },
      { cx: x + h1 + h2 + (w - h1 - h2) / 2, label: '×' + MATCH.score.sure },
    ];
    ctx.font = 'bold 13px "Noto Sans SC",sans-serif';
    ctx.textAlign = 'center';
    for (const m of marks) {
      ctx.fillStyle = 'rgba(10,8,12,0.55)';
      ctx.fillText(m.label, m.cx + 1, by + 15);
      ctx.fillStyle = 'rgba(255,250,235,0.95)';
      ctx.fillText(m.label, m.cx, by + 14);
    }

    // 游标
    const elapsed = Math.min(total, Math.max(0, now - seg.activeAt));
    const px = x + (elapsed / total) * w;
    ctx.strokeStyle = '#fff8e2';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px, by - 4);
    ctx.lineTo(px, by + bh + 4);
    ctx.stroke();
    ctx.restore();
  }

  drawHeroes(run) {
    const ctx = this.ctx;
    for (let p = 0; p < 2; p++) {
      const player = run.players[p];
      const prefix = p === 0 ? 'red' : 'blue';
      const anim = this.heroAnim[p];
      let pose = 'idle';
      if (!player.alive) pose = 'dead';
      else if (anim && this.t < anim.until) pose = anim.pose;
      else if (run.phase === 'result' && run.winner !== p) pose = 'dead';

      const key = IMG[`${prefix}_${pose}`] ? `${prefix}_${pose}` : `${prefix}_idle`;
      if (!IMG[key]) continue;
      const baseX = p === 0 ? LAYOUT.heroLeftX : LAYOUT.heroRightX;
      const s = LAYOUT.heroScale;
      const w = IMG[key].width * s;
      const h = IMG[key].height * s;
      const img = this.prep(key, w, h);
      const drawH = h;
      // 矮姿态（下劈/倒地）按比例抬一点，脚底不动
      const bottom = GROUND_Y + 16;

      ctx.save();
      if (p === 1) {
        ctx.translate(baseX, 0);
        ctx.scale(-1, 1);
        ctx.translate(-baseX, 0);
      }
      ctx.drawImage(img, baseX - w / 2, bottom - drawH, w, drawH);

      ctx.restore();

      // 脚下光环：用缓存的圆形光斑图，避免每帧建渐变
      const glow = 0.16 + this.comboGlow[p] * 0.55;
      const halo = this.prep(p === 0 ? 'bg_fire' : 'bg_thunder', 200, 140);
      if (halo) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = glow * 0.35;
        ctx.drawImage(halo, baseX - 100, GROUND_Y - 60, 200, 140);
        ctx.restore();
      }
    }
  }

  drawFlying() {
    const ctx = this.ctx;
    const img = IMG.log;
    for (const f of this.flying) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      ctx.globalAlpha = Math.max(0, 1 - (this.t - f.born) / 700);
      if (img) ctx.drawImage(img, -TRUNK_W * 0.3, -SEG_H * 0.3, TRUNK_W * 0.6, SEG_H * 0.6);
      ctx.restore();
    }
  }

  drawParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const k = 1 - (this.t - p.born) / p.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, k);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.restore();
    }
  }

  drawBolts() {
    const ctx = this.ctx;
    for (const b of this.bolts) {
      const k = 1 - (this.t - b.born) / b.life;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, k);
      ctx.strokeStyle = b.strong ? '#e8c7ff' : '#ffe0a0';
      ctx.lineWidth = b.strong ? 7 : 5;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 22;
      ctx.beginPath();
      b.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.restore();
    }
  }

  drawFloaters() {
    const ctx = this.ctx;
    for (const f of this.floaters) {
      const age = (this.t - f.born) / 900;
      const rise = easeOut(age) * 70;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - age * age);
      ctx.textAlign = 'center';
      ctx.font = font(52);
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(8,6,10,0.85)';
      ctx.strokeText(f.text, f.x, f.y - rise);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - rise);
      if (f.sub) {
        ctx.font = font(24);
        ctx.lineWidth = 6;
        ctx.strokeText(f.sub, f.x, f.y - rise + 32);
        ctx.fillStyle = '#fff8e2';
        ctx.fillText(f.sub, f.x, f.y - rise + 32);
      }
      ctx.restore();
    }
  }


}

export { font, roundRect, GROUND_Y, TRUNK_X, TRUNK_W, SEG_H, SEG_STEP, segY };
