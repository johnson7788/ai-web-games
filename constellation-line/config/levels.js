// config/levels.js — 24 关星座库（原创内容：星座连线=欧拉路径图）
//
// 数据契约：每个关卡 = 无向图（stars=节点，lines=边）。玩家从 start 星出发，
// 沿边一笔连完所有边（每条边恰走一次，欧拉路径）。关卡按「边型轮换」生成：
//   open    开路（2 个奇度点，起终点固定）
//   circuit 回路（0 个奇度点，任意起点绕回）
//   waypoint 带必经节点（环 + 弦，弦端点=北极星必经岔口）
//   dual    双星图（两个独立子图，交替切换画笔）
//
// 生成策略保证可解：open=相邻节点连成链；circuit=闭合环；waypoint=环+弦；
// dual=两个各自满足欧拉的子图。度数奇点每个连通分量必为 0 或 2（单测验证）。
//
// 坐标空间：逻辑 1000×562（16:9），渲染层统一等比缩放居中。

export const LOGICAL = { W: 1000, H: 562 };

const P = (x, y) => [Math.round(x), Math.round(y)];

// 环形布点（circuit / waypoint 用）：椭圆上均匀取 n 点，从 12 点方向起。
function ring(n, cx = 500, cy = 280, rx = 300, ry = 175, rot = 0) {
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const a = rot + (i / n) * Math.PI * 2 - Math.PI / 2;
    pts.push(P(cx + rx * Math.cos(a), cy + ry * Math.sin(a)));
  }
  return pts;
}

// 沿线布点（open 链 / 蛇形用）：从 a 到 b 均分 n 点，带少量正弦偏移制造有机感。
function chain(n, a, b, bow = 0, phase = 0) {
  const [x0, y0] = a;
  const [x1, y1] = b;
  const pts = [];
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 0; i < n; i += 1) {
    const t = n === 1 ? 0 : i / (n - 1);
    const off = bow * Math.sin(Math.PI * t + phase);
    pts.push(P(x0 + dx * t + nx * off, y0 + dy * t + ny * off));
  }
  return pts;
}

// 由点集按模式生成边。
function openEdges(nodes) {
  const edges = [];
  for (let i = 0; i + 1 < nodes.length; i += 1) edges.push([i, i + 1]);
  return edges;
}

function circuitEdges(n) {
  const edges = [];
  for (let i = 0; i < n; i += 1) edges.push([i, (i + 1) % n]);
  return edges;
}

// waypoint = 环 + 弦（0 号到 k 号）。弦端点度数 +1 → 两个奇点，必为欧拉开路。
function waypointEdges(n, chordTo = null) {
  const edges = circuitEdges(n);
  const k = chordTo == null ? Math.max(1, Math.floor(n / 2)) : chordTo;
  edges.push([0, k]);
  return { edges, chord: [0, k] };
}

function comp(nodes, edges, start) {
  return { nodes: nodes.map((p) => ({ x: p[0], y: p[1] })), edges, start };
}

function meteorOn(comp, edgeIdx, periodSec = 7, blockedSec = 2) {
  const [a, b] = comp.edges[edgeIdx % comp.edges.length];
  return { edge: [a, b], periodSec, blockedSec };
}

let _id = 0;
function level(o) {
  _id += 1;
  const { nodes, edges, start, type, name, zhName, scene, waypoint, meteor, timeLimitSec } = o;
  const single = comp(nodes, edges, start);
  return {
    id: _id,
    type,
    name,
    zhName,
    scene,
    components: [single],
    nodes: single.nodes,
    edges: single.edges,
    start,
    waypoint: waypoint ?? null,
    meteor: meteor ?? null,
    timeLimitSec,
    edgeCount: single.edges.length,
    nodeCount: single.nodes.length,
  };
}

// ---- 场景 0 · 春夜（蓝紫）：三角 / 天琴 / 仙后 / 南十字 ----
const L = [];

// L1 Triangulum — 三角 + 尾（open，5 节点）
{
  const nodes = [P(500, 110), P(245, 400), P(755, 400), P(500, 250), P(500, 430)];
  L.push(level({ type: 'open', name: 'Triangulum', zhName: '三角座', scene: 0, nodes, edges: openEdges(nodes), start: 0, timeLimitSec: 45 }));
}
// L2 Triangulum Loop — 五边形回路（circuit，5 节点）
{
  const nodes = ring(5, 500, 285, 285, 165);
  L.push(level({ type: 'circuit', name: 'Triangulum Loop', zhName: '三角回路', scene: 0, nodes, edges: circuitEdges(5), start: 0, timeLimitSec: 45 }));
}
// L3 Lyra — 竖琴 V（open，6 节点）
{
  const nodes = [P(320, 105), P(180, 235), P(320, 375), P(460, 235), P(320, 250), P(540, 250)];
  L.push(level({ type: 'open', name: 'Lyra', zhName: '天琴座', scene: 0, nodes, edges: openEdges(nodes), start: 0, timeLimitSec: 50 }));
}
// L4 Lyra Twin — 双子三角（dual，3+3 节点）
{
  const a = ring(3, 320, 280, 150, 150);
  const b = ring(3, 700, 280, 150, 150);
  L.push({
    ...level({ type: 'dual', name: 'Lyra Twin', zhName: '天琴双子', scene: 0, nodes: a, edges: circuitEdges(3), start: 0, timeLimitSec: 55 }),
    components: [comp(a, circuitEdges(3), 0), comp(b, circuitEdges(3), 0)],
  });
}
// L5 Cassiopeia — 仙后 W（open，6 节点）
{
  const nodes = [P(140, 185), P(300, 345), P(450, 195), P(600, 345), P(750, 195), P(890, 320)];
  L.push(level({ type: 'open', name: 'Cassiopeia', zhName: '仙后座', scene: 0, nodes, edges: openEdges(nodes), start: 0, timeLimitSec: 55 }));
}
// L6 Cassiopeia Crown — 王冠 + 必经弦（waypoint，7 节点）
{
  const nodes = ring(7, 500, 280, 300, 175);
  const { edges, chord } = waypointEdges(7);
  L.push(level({ type: 'waypoint', name: 'Cassiopeia Crown', zhName: '仙后王冠', scene: 0, nodes, edges, start: 0, waypoint: chord[1], timeLimitSec: 60 }));
}
// L7 Crux — 十字链（open，7 节点）
{
  const nodes = [P(500, 95), P(500, 180), P(390, 250), P(500, 320), P(610, 250), P(500, 400), P(500, 480)];
  L.push(level({ type: 'open', name: 'Crux', zhName: '南十字座', scene: 0, nodes, edges: openEdges(nodes), start: 0, timeLimitSec: 60 }));
}
// L8 Crux Cross — 十字王冠（waypoint，8 节点）
{
  const nodes = ring(8, 500, 280, 305, 180);
  const { edges, chord } = waypointEdges(8);
  L.push(level({ type: 'waypoint', name: 'Crux Cross', zhName: '十字王冠', scene: 0, nodes, edges, start: 0, waypoint: chord[1], timeLimitSec: 65 }));
}

// ---- 场景 1 · 夏银河（亮白）：天鹅 / 小熊 / 猎户 / 金牛 ----
// L9 Cygnus — 天鹅十字（open，9 节点）
{
  const nodes = [
    P(500, 90), P(500, 165), P(390, 225), P(290, 300), P(215, 385),
    P(500, 265), P(610, 225), P(710, 300), P(790, 385),
  ];
  L.push(level({ type: 'open', name: 'Cygnus', zhName: '天鹅座', scene: 1, nodes, edges: openEdges(nodes), start: 0, timeLimitSec: 70 }));
}
// L10 Cygnus Wing — 天鹅翼 + 流星（waypoint + meteor，10 节点）
{
  const nodes = ring(10, 500, 285, 310, 185);
  const { edges, chord } = waypointEdges(10, 4);
  L.push(level({ type: 'waypoint', name: 'Cygnus Wing', zhName: '天鹅之翼', scene: 1, nodes, edges, start: 0, waypoint: chord[1], meteor: { edge: chord, periodSec: 7, blockedSec: 2 }, timeLimitSec: 75 }));
}
// L11 Ursa Minor — 小熊勺（open，8 节点）
{
  const nodes = [P(230, 150), P(150, 245), P(280, 290), P(430, 300), P(560, 340), P(680, 380), P(780, 430), P(840, 480)];
  L.push(level({ type: 'open', name: 'Ursa Minor', zhName: '小熊座', scene: 1, nodes, edges: openEdges(nodes), start: 0, timeLimitSec: 65 }));
}
// L12 Ursa Minor Twin — 双勺（dual，5+4 节点）
{
  const a = chain(5, [200, 150], [420, 300], 40);
  const b = chain(4, [620, 180], [850, 330], 55);
  L.push({
    ...level({ type: 'dual', name: 'Ursa Minor Twin', zhName: '小熊双子', scene: 1, nodes: a, edges: openEdges(a), start: 0, timeLimitSec: 70 }),
    components: [comp(a, openEdges(a), 0), comp(b, openEdges(b), 0)],
  });
}
// L13 Orion — 猎户沙漏（open，11 节点）
{
  const nodes = [
    P(200, 120), P(360, 120), P(500, 90), P(640, 120), P(800, 120),
    P(700, 230), P(500, 300), P(300, 230), P(420, 380), P(500, 460), P(580, 380),
  ];
  L.push(level({ type: 'open', name: 'Orion', zhName: '猎户座', scene: 1, nodes, edges: openEdges(nodes), start: 0, timeLimitSec: 80 }));
}
// L14 Orion Belt — 猎户腰带 + 流星（waypoint + meteor，12 节点）
{
  const nodes = ring(12, 500, 285, 320, 190);
  const { edges, chord } = waypointEdges(12, 5);
  L.push(level({ type: 'waypoint', name: 'Orion Belt', zhName: '猎户腰带', scene: 1, nodes, edges, start: 0, waypoint: chord[1], meteor: { edge: chord, periodSec: 6, blockedSec: 2 }, timeLimitSec: 85 }));
}
// L15 Taurus — 金牛 V（open，10 节点）
{
  const nodes = [
    P(140, 140), P(240, 300), P(360, 420), P(500, 480), P(640, 420), P(760, 300), P(860, 140),
    P(500, 320), P(500, 210), P(500, 100),
  ];
  L.push(level({ type: 'open', name: 'Taurus', zhName: '金牛座', scene: 1, nodes, edges: openEdges(nodes), start: 0, timeLimitSec: 80 }));
}
// L16 Taurus Horn — 牛角王冠（waypoint，12 节点）
{
  const nodes = ring(12, 500, 285, 315, 185);
  const { edges, chord } = waypointEdges(12, 6);
  L.push(level({ type: 'waypoint', name: 'Taurus Horn', zhName: '金牛之角', scene: 1, nodes, edges, start: 0, waypoint: chord[1], timeLimitSec: 90 }));
}

// ---- 场景 2 · 极光冬（青绿）：大熊 / 双子 / 英仙 / 天龙 ----
// L17 Ursa Major — 大熊勺（open，9 节点）
{
  const nodes = [P(180, 130), P(120, 230), P(250, 280), P(410, 300), P(570, 340), P(700, 400), P(790, 460), P(860, 470), P(910, 400)];
  L.push(level({ type: 'open', name: 'Ursa Major', zhName: '大熊座', scene: 2, nodes, edges: openEdges(nodes), start: 0, timeLimitSec: 70 }));
}
// L18 Ursa Major Twin — 大熊双子（dual，6+5 节点）
{
  const a = chain(6, [170, 150], [430, 320], 45);
  const b = chain(5, [610, 160], [870, 320], 60);
  L.push({
    ...level({ type: 'dual', name: 'Ursa Major Twin', zhName: '大熊双子', scene: 2, nodes: a, edges: openEdges(a), start: 0, timeLimitSec: 75 }),
    components: [comp(a, openEdges(a), 0), comp(b, openEdges(b), 0)],
  });
}
// L19 Gemini — 双子人形（open，13 节点）
{
  const nodes = [
    P(280, 100), P(280, 180), P(180, 250), P(280, 320), P(380, 250), P(280, 420), P(280, 500),
    P(500, 380), P(640, 420), P(720, 320), P(760, 250), P(860, 250), P(860, 100),
  ];
  L.push(level({ type: 'open', name: 'Gemini', zhName: '双子座', scene: 2, nodes, edges: openEdges(nodes), start: 0, timeLimitSec: 90 }));
}
// L20 Gemini Full — 双子满星 + 流星（waypoint + meteor，14 节点）
{
  const nodes = ring(14, 500, 285, 330, 195);
  const { edges, chord } = waypointEdges(14, 7);
  L.push(level({ type: 'waypoint', name: 'Gemini Full', zhName: '双子满星', scene: 2, nodes, edges, start: 0, waypoint: chord[1], meteor: { edge: chord, periodSec: 6, blockedSec: 2 }, timeLimitSec: 100 }));
}
// L21 Perseus — 英仙蛇形（open，14 节点）
{
  const nodes = chain(14, [150, 420], [860, 150], 90, 0.7);
  L.push(level({ type: 'open', name: 'Perseus', zhName: '英仙座', scene: 2, nodes, edges: openEdges(nodes), start: 0, timeLimitSec: 95 }));
}
// L22 Perseus Crown — 英仙王冠（waypoint，15 节点）
{
  const nodes = ring(15, 500, 285, 335, 198);
  const { edges, chord } = waypointEdges(15, 7);
  L.push(level({ type: 'waypoint', name: 'Perseus Crown', zhName: '英仙王冠', scene: 2, nodes, edges, start: 0, waypoint: chord[1], timeLimitSec: 105 }));
}
// L23 Draco — 天龙长蛇（open，16 节点）
{
  const nodes = chain(16, [140, 170], [880, 400], 120, 1.2);
  L.push(level({ type: 'open', name: 'Draco', zhName: '天龙座', scene: 2, nodes, edges: openEdges(nodes), start: 0, timeLimitSec: 110 }));
}
// L24 Draco Twin — 天龙双尾 + 流星（dual + meteor，10+8 节点）
{
  const a = chain(10, [150, 180], [500, 300], 70);
  const b = chain(8, [560, 300], [900, 210], 80);
  L.push({
    ...level({ type: 'dual', name: 'Draco Twin', zhName: '天龙双尾', scene: 2, nodes: a, edges: openEdges(a), start: 0, meteor: { edge: [0, 1], periodSec: 7, blockedSec: 2 }, timeLimitSec: 120 }),
    components: [comp(a, openEdges(a), 0), comp(b, openEdges(b), 0)],
  });
}

export const LEVELS = L;
export const LEVEL_COUNT = L.length;

export const SCENES = [
  { id: 0, name: 'Spring Night', zhName: '春夜', palette: ['#1a1038', '#2a1a5e', '#6f5bd0', '#b7a6ff'] },
  { id: 1, name: 'Summer Milky Way', zhName: '夏银河', palette: ['#101826', '#273a52', '#8fd0ff', '#f2fbff'] },
  { id: 2, name: 'Aurora Winter', zhName: '极光冬', palette: ['#06221f', '#0d3a3a', '#2fd6b2', '#a7fff0'] },
];

export function getLevel(i) {
  return L[Math.max(0, Math.min(LEVEL_COUNT - 1, i))];
}
