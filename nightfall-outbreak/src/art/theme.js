// src/art/theme.js — 废土夜色主题常量 + 小地图绘制
// 颜色与 styles.css 的 --cyan / --orange / 各敌型染色同源维护；
// 这里只画 radar 与 HUD 上的 Canvas 图形，不参与 3D 渲染。
import { GAME } from "config/game.config.js";

export const PALETTE = {
  bg: "#08171d",
  ring: "rgba(87,224,234,.26)",
  edge: "rgba(87,224,234,.62)",
  sweep: "rgba(87,224,234,.13)",
  player: "#57e0ea",
  fire: "#ff7a3c",
  enemy: {
    shambler: "#87a58e",
    runner: "#ff8a5c",
    brute: "#c8d7d0",
    bloater: "#ffc05a",
    boss: "#ff4d4d"
  }
};

const RADAR_RANGE = 34;   // 米：小地图能看到的半径

/** 把 Game.snapshot().radar 画到 132×132 的扫描盘上。 */
export function drawMinimap(canvas, snap) {
  if (!canvas) return;
  const g = canvas.getContext("2d");
  if (!g) return;
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2, R = Math.min(cx, cy) - 6;
  g.clearRect(0, 0, w, h);
  g.fillStyle = PALETTE.bg;
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();

  g.strokeStyle = PALETTE.ring;
  g.lineWidth = 1;
  for (const f of [0.34, 0.67, 1]) {
    g.beginPath(); g.arc(cx, cy, R * f, 0, Math.PI * 2); g.stroke();
  }
  g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy);
  g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();

  // 扫描扇形：始终指向玩家视线方向（yaw=0 朝屏幕上方）
  const yaw = snap?.player?.yaw || 0;
  g.fillStyle = PALETTE.sweep;
  g.beginPath(); g.moveTo(cx, cy);
  g.arc(cx, cy, R, -Math.PI / 2 + yaw - 0.42, -Math.PI / 2 + yaw + 0.42);
  g.closePath(); g.fill();

  const k = R / RADAR_RANGE;
  for (const p of snap?.radar || []) {
    const x = cx + p.x * k, y = cy + p.y * k;
    if (Math.hypot(x - cx, y - cy) > R - 3) continue;
    g.fillStyle = PALETTE.enemy[p.kind] || PALETTE.enemy.shambler;
    g.beginPath();
    g.arc(x, y, p.kind === "boss" ? 5 : 3, 0, Math.PI * 2);
    g.fill();
  }

  // 玩家：朝视线方向的三角
  g.save();
  g.translate(cx, cy);
  g.rotate(yaw);
  g.fillStyle = PALETTE.player;
  g.beginPath();
  g.moveTo(0, -8); g.lineTo(5.5, 6); g.lineTo(0, 3); g.lineTo(-5.5, 6);
  g.closePath(); g.fill();
  g.restore();

  g.strokeStyle = PALETTE.edge;
  g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
}

/** 逻辑舞台常量（HUD 与 3D 共用同一坐标系） */
export const STAGE = { w: GAME.design.width, h: GAME.design.height, cx: GAME.design.width / 2, cy: GAME.design.height / 2 };

/** 关卡主题：不引入随机，按章节切冷暖，保证同一章观感连贯 */
export function themeForLevel(level) {
  const chapter = level?.chapter || 1;
  return {
    fog: level?.twistAxis === "info" ? 0.030 : 0.019 + (chapter - 1) * 0.002,
    fire: chapter === 1 ? 2.4 : 2.9,
    moon: chapter === 1 ? 1.35 : 1.12
  };
}
