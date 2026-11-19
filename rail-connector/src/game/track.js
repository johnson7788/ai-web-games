// track.js — 纯轨道几何：方向常量 + 瓦片连接规则（零依赖，Node/浏览器通用）。
//
// 方向用 0..3 整数：0=N(上, r-1) 1=E(右, c+1) 2=S(下, r+1) 3=W(左, c-1)。
// 瓦片形状：
//   straight rot0 = 水平（E<->W）  rot1 = 垂直（N<->S）
//   curve rot r = 连接 r 与 (r+1)%4 两个相邻方向（四角）。
// 开关(switch)持有 states: shape[]，玩家循环切换 stateIndex。

export const N = 0;
export const E = 1;
export const S = 2;
export const W = 3;

export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];

export const opposite = (d) => (d + 2) % 4;

/** 由进入方向 from 与离开方向 to 推导一个能连通的直线/弯道瓦片。 */
export function tileFor(from, to) {
  if (opposite(from) === to) {
    // 直线：E/W 方向是水平，N/S 是垂直
    return { kind: 'straight', rot: (from === E || from === W) ? 0 : 1 };
  }
  for (let rot = 0; rot < 4; rot += 1) {
    const a = rot;
    const b = (rot + 1) % 4;
    if ((a === from && b === to) || (a === to && b === from)) {
      return { kind: 'curve', rot };
    }
  }
  return null;
}

/** 某形状的连接表：{ entryDir: exitDir }。 */
export function connections(shape) {
  if (!shape) return {};
  if (shape.kind === 'straight') {
    return shape.rot === 0 ? { [E]: W, [W]: E } : { [N]: S, [S]: N };
  }
  if (shape.kind === 'curve') {
    const a = shape.rot % 4;
    const b = (shape.rot + 1) % 4;
    return { [a]: b, [b]: a };
  }
  return {};
}

/** 从某个方向进入该形状后离开的方向；不通返回 null。 */
export function exitOf(shape, from) {
  const c = connections(shape);
  return Object.prototype.hasOwnProperty.call(c, from) ? c[from] : null;
}

/** 两个相邻格之间的方向（要求曼哈顿距离为 1）。 */
export function dirBetween(a, b) {
  const dr = b[0] - a[0];
  const dc = b[1] - a[1];
  if (dc === 1) return E;
  if (dc === -1) return W;
  if (dr === 1) return S;
  return N;
}
