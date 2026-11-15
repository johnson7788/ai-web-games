/**
 * Match director — the portal-facing game loop around the raw firefight sim.
 *
 * The upstream project boots straight into a free-roam sandbox with no title
 * screen, no respawn and a finite garrison. For the portal build this system
 * adds the missing furniture:
 *
 *   title  → DEPLOY (user gesture: unlocks audio + requests pointer lock)
 *   play   → 5:00 clock, first to 20 eliminations wins; enemy reinforcements
 *            keep the fight alive; dead agents are recycled
 *   kia    → 3 s countdown, then redeploy at a random spawn with full ammo
 *   end    → MISSION ACCOMPLISHED / FAILED screen with stats + REDEPLOY
 *
 * It is a regular subsystem (static id/deps) so the engine sequences it after
 * ui/ai/player/weapons exist. All DOM lives outside .ow-hud so the kit i18n
 * layer translates it like any other page text.
 */

import { el, setText, setStyle, mmss, FONT_STACK, FONT_DISPLAY } from '../ui/util.js';

const MATCH_TIME = 300; // seconds
const KILL_TARGET = 20;
const KIA_DELAY = 3; // seconds
const REINFORCE_COOLDOWN = 12; // seconds between reinforcement waves
const REINFORCE_WHEN_ALIVE = 2; // top up when this few hostiles remain

const CSS = `
.sw-ov {
  position: fixed; inset: 0; z-index: 30;
  display: flex; align-items: center; justify-content: center;
  font-family: ${FONT_STACK};
  color: rgba(238,244,247,.95);
  letter-spacing: .06em; text-transform: uppercase;
  font-variant-numeric: tabular-nums;
  user-select: none; -webkit-font-smoothing: antialiased;
}
.sw-ov * { margin: 0; padding: 0; box-sizing: border-box; }
#sw-title {
  z-index: 35; cursor: default;
  background:
    radial-gradient(120% 90% at 50% 0%, rgba(10,14,18,.55) 0%, rgba(6,9,12,.88) 70%, rgba(4,6,9,.96) 100%);
}
#sw-title::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(0deg, rgba(255,255,255,.022) 0 1px, transparent 1px 3px);
}
.sw-t-inner { position: relative; text-align: center; padding: 24px; max-width: 780px; width: 100%; }
.sw-t-kicker {
  font-size: 12px; letter-spacing: .34em; color: #ffb02a;
  text-shadow: 0 1px 2px rgba(0,0,0,.9); margin-bottom: 10px;
}
.sw-t-h1 {
  font-family: ${FONT_DISPLAY};
  font-size: clamp(52px, 9vw, 96px); line-height: .95; font-weight: 700;
  letter-spacing: .045em; color: rgba(238,244,247,.97);
  text-shadow: 0 2px 3px rgba(0,0,0,.95), 0 0 26px rgba(0,0,0,.6);
}
.sw-t-h1 b { color: #ffb02a; font-weight: 700; }
.sw-t-rule {
  width: 210px; height: 2px; margin: 16px auto 14px;
  background: linear-gradient(90deg, transparent, #ffb02a 30%, #ffb02a 70%, transparent);
}
.sw-t-obj {
  font-size: 14px; line-height: 1.5; letter-spacing: .1em;
  color: rgba(214,227,234,.78); text-shadow: 0 1px 2px rgba(0,0,0,.9);
  max-width: 560px; margin: 0 auto 18px;
}
.sw-t-ctl {
  display: grid; grid-template-columns: repeat(4, minmax(0,1fr));
  gap: 7px 14px; max-width: 620px; margin: 0 auto 18px; text-align: left;
}
.sw-ctl { display: flex; align-items: baseline; gap: 8px; font-size: 11.5px; }
.sw-ctl b {
  flex: 0 0 auto; min-width: 52px; text-align: center;
  font: 700 10.5px/1 ${FONT_STACK}; letter-spacing: .08em;
  color: rgba(238,244,247,.92); background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.22); border-bottom-width: 2px;
  border-radius: 4px; padding: 4px 6px;
}
.sw-ctl span { color: rgba(214,227,234,.66); letter-spacing: .12em; }
.sw-t-q { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 20px; font-size: 11px; }
.sw-t-q .lbl { color: rgba(214,227,234,.55); letter-spacing: .22em; }
.sw-qbtn {
  font: 600 11px/1 ${FONT_STACK}; letter-spacing: .14em; text-transform: uppercase;
  color: rgba(214,227,234,.7); background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.2); border-radius: 5px;
  padding: 6px 12px; cursor: pointer;
}
.sw-qbtn:hover { border-color: rgba(255,176,42,.7); color: rgba(238,244,247,.95); }
.sw-qbtn.on { background: rgba(255,176,42,.16); border-color: #ffb02a; color: #ffb02a; }
#sw-deploy {
  font: 700 20px/1 ${FONT_DISPLAY}; letter-spacing: .3em; text-transform: uppercase;
  color: #0b0e11; background: #ffb02a; border: 0; border-radius: 6px;
  padding: 16px 58px 15px 62px; cursor: pointer;
  box-shadow: 0 2px 0 rgba(0,0,0,.55), 0 0 34px rgba(255,176,42,.22);
}
#sw-deploy:hover:not(:disabled) { background: #ffc45e; }
#sw-deploy:disabled { background: rgba(255,176,42,.35); color: rgba(11,14,17,.75); cursor: wait; }
.sw-t-note { margin-top: 14px; font-size: 10.5px; letter-spacing: .14em; color: rgba(214,227,234,.45); }
.sw-t-credit { margin-top: 16px; font-size: 10px; letter-spacing: .1em; color: rgba(214,227,234,.38); text-transform: none; }
.sw-t-credit a { color: inherit; }
/* KIA + end screens sit under the title, over the HUD */
#sw-kia { z-index: 28; pointer-events: none; background: radial-gradient(80% 70% at 50% 50%, rgba(60,4,2,.28), rgba(20,2,1,.55)); }
.sw-k-inner { text-align: center; }
.sw-k-h {
  font-family: ${FONT_DISPLAY}; font-size: clamp(64px, 11vw, 120px); font-weight: 700;
  letter-spacing: .18em; color: #ff3f31; text-shadow: 0 2px 4px rgba(0,0,0,.95), 0 0 40px rgba(141,15,10,.8);
}
.sw-k-sub { margin-top: 6px; font-size: 14px; letter-spacing: .26em; color: rgba(238,244,247,.85); text-shadow: 0 1px 2px rgba(0,0,0,.9); }
.sw-k-sub b { color: #ffb02a; font-size: 18px; }
#sw-end { z-index: 32; background: radial-gradient(120% 90% at 50% 0%, rgba(10,14,18,.6), rgba(4,6,9,.92)); }
.sw-e-inner { text-align: center; padding: 24px; }
.sw-e-h {
  font-family: ${FONT_DISPLAY}; font-size: clamp(40px, 6.5vw, 72px); font-weight: 700; letter-spacing: .1em;
  text-shadow: 0 2px 4px rgba(0,0,0,.95), 0 0 34px rgba(0,0,0,.6);
}
.sw-e-h.win { color: #a8e86a; }
.sw-e-h.lose { color: #ff3f31; }
.sw-e-stats { display: flex; gap: 34px; justify-content: center; margin: 22px 0 26px; }
.sw-e-stat .v { font-family: ${FONT_DISPLAY}; font-size: 40px; font-weight: 700; color: rgba(238,244,247,.96); }
.sw-e-stat .l { margin-top: 2px; font-size: 10.5px; letter-spacing: .2em; color: rgba(214,227,234,.55); }
#sw-redeploy {
  font: 700 17px/1 ${FONT_DISPLAY}; letter-spacing: .26em; text-transform: uppercase;
  color: #0b0e11; background: #ffb02a; border: 0; border-radius: 6px;
  padding: 14px 44px 13px 48px; cursor: pointer;
}
#sw-redeploy:hover { background: #ffc45e; }
@media (max-width: 640px) {
  .sw-t-ctl { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .sw-e-stats { gap: 20px; }
}
`;

const CONTROLS = [
  ['W A S D', 'MOVE'],
  ['MOUSE', 'AIM'],
  ['LMB', 'FIRE'],
  ['RMB', 'ADS'],
  ['R', 'RELOAD'],
  ['SHIFT', 'SPRINT'],
  ['SPACE', 'JUMP'],
  ['ESC', 'PAUSE'],
  ['G', 'GRENADE'],
  ['V', 'MELEE'],
  ['F', 'USE'],
  ['1 / 2', 'SWAP'],
];

export class DirectorSystem {
  static id = 'director';
  static deps = ['ui', 'ai', 'player', 'weapons', 'audio'];

  async init(ctx) {
    this.ctx = ctx;
    this.state = 'title';
    this.paused = false;
    this.timeLeft = MATCH_TIME;
    this.kiaT = 0;
    this.lastReinforce = -REINFORCE_COOLDOWN;
    this.deaths = 0;
    this._ready = false;

    const style = document.createElement('style');
    style.id = 'sw-director-css';
    style.textContent = CSS;
    document.head.appendChild(style);
    this._style = style;

    this._buildTitle();
    this._buildKia();
    this._buildEnd();

    // The static boot splash (index.html) has done its job once the world exists.
    document.getElementById('sw-splash')?.remove();

    const ui = ctx.get('ui');
    ui.setMatch({ scoreUs: 0, scoreThem: 0, timeLeft: MATCH_TIME, mode: 'TDM' });

    if (ctx.config.deterministic) {
      // Dev capture harness (?capture=1) drives the sim directly through
      // __APPLY_SHOT__ — no portal gating there.
      this.state = 'play';
      setStyle(this.title, 'display', 'none');
      ui.setHudVisible(true);
    } else {
      ui.setHudVisible(false);
      // Freeze the world behind the title: an AFK player must not be shot by
      // patrols (or have the match clock run) before pressing DEPLOY.
      ctx.input.enabled = false;
      ctx.peek('player')?.setControlEnabled?.(false);
      this._prevScale = ctx.time.scale;
      ctx.time.scale = 0;
    }

    this._offs = [
      ctx.events.on('player:death', () => this._onDeath()),
      ctx.events.on('ui:pause', (e) => {
        this.paused = !!e?.paused;
      }),
    ];

    // The kit i18n layer translates text nodes in place; when the player
    // switches back to EN it cannot restore the source string on its own.
    // Rewrite our own static labels from the English source so the observer
    // re-translates them for the active language (zh → en round-trip).
    this._onLang = () => this._retext();
    window.addEventListener('langchange', this._onLang);
  }

  /** Re-emit English source text for every static label this system owns.
   *  Bypasses setText's change cache: the DOM may hold a translation while the
   *  cache still holds the English source, which would skip the restore. */
  _retext() {
    const force = (node, s) => {
      node._owText = undefined;
      setText(node, s);
    };
    force(this.kicker, 'FREE 3D FPS · 100% PROCEDURAL');
    force(this.obj, `Eliminate ${KILL_TARGET} hostiles before the clock runs out. Reinforcements keep coming — stay moving, use cover, reload smart.`);
    for (const [node, , act] of this.ctlRows) force(node, act);
    force(this.qLabel, 'GRAPHICS');
    for (const [b, name] of this.qBtns) force(b, name.toUpperCase());
    force(this.deployBtn, this._ready ? 'DEPLOY' : 'GENERATING WORLD…');
    force(this.note, 'Mouse locks on deploy · if locking is blocked, aim inside the canvas');
    this.credit.innerHTML =
      'Based on mshumer/Claude-of-Duty (MIT) — <a href="https://github.com/mshumer/Claude-of-Duty" target="_blank" rel="noopener">github.com/mshumer/Claude-of-Duty</a>';
    force(this.kiaHead, 'KIA');
    force(this.kiaLabel, 'REDEPLOYING IN ');
    force(this.endHead, this._lastWin ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED');
    force(this.endKillsL, 'HOSTILES ELIMINATED');
    force(this.endDeathsL, 'DEATHS');
    force(this.endTimeL, 'TIME REMAINING');
    force(this.redeployBtn, 'REDEPLOY');
  }

  /* ------------------------------------------------------------------ dom -- */

  _buildTitle() {
    const root = el('div', 'sw-ov', document.body);
    root.id = 'sw-title';
    const inner = el('div', 'sw-t-inner', root);
    this.kicker = el('div', 'sw-t-kicker', inner, 'FREE 3D FPS · 100% PROCEDURAL');
    const h1 = el('h1', 'sw-t-h1', inner);
    h1.innerHTML = 'STREET <b>WARFARE</b>';
    el('div', 'sw-t-rule', inner);
    this.obj = el(
      'p',
      'sw-t-obj',
      inner,
      `Eliminate ${KILL_TARGET} hostiles before the clock runs out. Reinforcements keep coming — stay moving, use cover, reload smart.`
    );
    const ctl = el('div', 'sw-t-ctl', inner);
    this.ctlRows = [];
    for (const [key, act] of CONTROLS) {
      const row = el('div', 'sw-ctl', ctl);
      el('b', null, row, key);
      const span = el('span', null, row, act);
      this.ctlRows.push([span, key, act]);
    }
    const q = el('div', 'sw-t-q', inner);
    this.qLabel = el('span', 'lbl', q, 'GRAPHICS');
    this.qBtns = [];
    for (const name of ['low', 'medium', 'high', 'ultra']) {
      const b = el('button', 'sw-qbtn', q, name.toUpperCase());
      b.type = 'button';
      b.addEventListener('click', () => this._setQuality(name));
      this.qBtns.push([b, name]);
    }
    this._syncQuality();
    this.deployBtn = el('button', null, inner, 'GENERATING WORLD…');
    this.deployBtn.id = 'sw-deploy';
    this.deployBtn.type = 'button';
    this.deployBtn.disabled = true;
    this.deployBtn.addEventListener('click', () => this._deploy());
    this.note = el('div', 'sw-t-note', inner, 'Mouse locks on deploy · if locking is blocked, aim inside the canvas');
    this.credit = el('div', 'sw-t-credit', inner);
    this.credit.innerHTML =
      'Based on mshumer/Claude-of-Duty (MIT) — <a href="https://github.com/mshumer/Claude-of-Duty" target="_blank" rel="noopener">github.com/mshumer/Claude-of-Duty</a>';
    this.title = root;
  }

  _buildKia() {
    const root = el('div', 'sw-ov', document.body);
    root.id = 'sw-kia';
    const inner = el('div', 'sw-k-inner', root);
    this.kiaHead = el('div', 'sw-k-h', inner, 'KIA');
    const sub = el('div', 'sw-k-sub', inner);
    this.kiaLabel = el('span', null, sub, 'REDEPLOYING IN ');
    this.kiaCount = el('b', null, sub, String(KIA_DELAY));
    setStyle(root, 'display', 'none');
    this.kia = root;
  }

  _buildEnd() {
    const root = el('div', 'sw-ov', document.body);
    root.id = 'sw-end';
    const inner = el('div', 'sw-e-inner', root);
    this._lastWin = false;
    this.endHead = el('div', 'sw-e-h win', inner, 'MISSION ACCOMPLISHED');
    const stats = el('div', 'sw-e-stats', inner);
    const mk = (label) => {
      const s = el('div', 'sw-e-stat', stats);
      const v = el('div', 'v', s, '0');
      const l = el('div', 'l', s, label);
      return [v, l];
    };
    [this.endKills, this.endKillsL] = mk('HOSTILES ELIMINATED');
    [this.endDeaths, this.endDeathsL] = mk('DEATHS');
    [this.endTime, this.endTimeL] = mk('TIME REMAINING');
    this.redeployBtn = el('button', null, inner, 'REDEPLOY');
    this.redeployBtn.id = 'sw-redeploy';
    this.redeployBtn.type = 'button';
    this.redeployBtn.addEventListener('click', () => this._restart());
    setStyle(root, 'display', 'none');
    this.end = root;
  }

  _setQuality(name) {
    try {
      this.ctx.config.setQuality(name);
      this.ctx.events.emit('ui:quality', { quality: name });
    } catch {
      /* preset switch is best-effort */
    }
    this._syncQuality();
  }

  _syncQuality() {
    for (const [b, name] of this.qBtns) b.classList.toggle('on', name === this.ctx.config.quality);
  }

  /** Called by main.js once prewarm finishes and the frame loop is live. */
  setReady() {
    this._ready = true;
    this.deployBtn.disabled = false;
    setText(this.deployBtn, 'DEPLOY');
  }

  /* --------------------------------------------------------------- flow -- */

  _deploy() {
    if (!this._ready || this.state !== 'title') return;
    this.state = 'play';
    setStyle(this.title, 'display', 'none');
    const ctx = this.ctx;
    ctx.time.scale = this._prevScale ?? 1;
    ctx.input.enabled = true;
    ctx.peek('player')?.setControlEnabled?.(true);
    const hp = ctx.peek('player')?.health;
    if (hp) hp.spawnProtectUntil = ctx.time.elapsed + 2;
    ctx.get('ui').setHudVisible(true);
    ctx.input.requestPointerLock();
    ctx.get('ui').banner.show('OPERATION LIVE', `Eliminate ${KILL_TARGET} hostiles · ${mmss(MATCH_TIME)} on the clock`, 3);
    try {
      window.PipySDK?.newRun({ slug: 'street-warfare' });
    } catch {
      /* SDK optional */
    }
  }

  _onDeath() {
    if (this.state !== 'play') return;
    this.state = 'kia';
    this.kiaT = KIA_DELAY;
    this.deaths++;
    const ctx = this.ctx;
    ctx.input.enabled = false;
    ctx.peek('player')?.setControlEnabled?.(false);
    ctx.get('ui').setMatch({ scoreThem: this.deaths });
    setText(this.kiaCount, String(KIA_DELAY));
    setStyle(this.kia, 'display', '');
    // Keep the pointer lock (if any): the camera stays put during the countdown.
  }

  _respawn() {
    const ctx = this.ctx;
    const world = ctx.peek('world');
    const n = world?.spawnPoints?.length ?? 1;
    const idx = Math.floor(ctx.rng.range(0, n));
    ctx.peek('player')?.respawn?.(idx);
    ctx.peek('weapons')?.resupply?.();
    const hp = ctx.peek('player')?.health;
    if (hp) hp.spawnProtectUntil = ctx.time.elapsed + 2;
    ctx.input.enabled = true;
    ctx.peek('player')?.setControlEnabled?.(true);
    setStyle(this.kia, 'display', 'none');
    this.state = 'play';
    ctx.get('ui').banner.show('REDEPLOYED', 'Get back in the fight', 1.6);
  }

  _end(win) {
    this.state = 'end';
    const ctx = this.ctx;
    ctx.input.enabled = false;
    ctx.peek('player')?.setControlEnabled?.(false);
    try {
      document.exitPointerLock?.();
    } catch {
      /* noop */
    }
    const ui = ctx.get('ui');
    this._lastWin = win;
    setText(this.endHead, win ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED');
    this.endHead.className = 'sw-e-h ' + (win ? 'win' : 'lose');
    setText(this.endKills, String(ui.state.scoreUs));
    setText(this.endDeaths, String(this.deaths));
    setText(this.endTime, mmss(this.timeLeft));
    setStyle(this.end, 'display', '');
    try {
      if (win) window.PipySDK?.levelCleared({ kills: ui.state.scoreUs, deaths: this.deaths });
      else window.PipySDK?.gameOver({ kills: ui.state.scoreUs, deaths: this.deaths });
    } catch {
      /* SDK optional */
    }
  }

  _restart() {
    if (this.state !== 'end') return;
    const ctx = this.ctx;
    const world = ctx.peek('world');
    const n = world?.spawnPoints?.length ?? 1;
    ctx.peek('player')?.respawn?.(Math.floor(ctx.rng.range(0, n)));
    ctx.peek('weapons')?.resupply?.();
    const hp = ctx.peek('player')?.health;
    if (hp) hp.spawnProtectUntil = ctx.time.elapsed + 2;
    const ai = ctx.peek('ai');
    // Recycle the whole garrison so a fresh match starts clean (ranked against
    // the player's fresh spawn position).
    if (ai) {
      for (const a of ai.agents) a.dispose?.();
      ai.agents.length = 0;
      for (const s of ai.squads) s.members.length = 0;
      ai.squads.length = 0;
      ai.populate({ squads: 2, perSquad: 3 });
    }
    const ui = ctx.get('ui');
    ui.state.scoreUs = 0;
    ui.killfeed.clear();
    this.deaths = 0;
    this.timeLeft = MATCH_TIME;
    this.lastReinforce = ctx.time.elapsed;
    ui.setMatch({ scoreUs: 0, scoreThem: 0, timeLeft: MATCH_TIME });
    setStyle(this.end, 'display', 'none');
    this.state = 'play';
    ctx.input.enabled = true;
    ctx.peek('player')?.setControlEnabled?.(true);
    ui.setHudVisible(true);
    ctx.input.requestPointerLock();
    ui.banner.show('OPERATION LIVE', `Eliminate ${KILL_TARGET} hostiles · ${mmss(MATCH_TIME)} on the clock`, 3);
    try {
      window.PipySDK?.newRun({ slug: 'street-warfare' });
    } catch {
      /* SDK optional */
    }
  }

  /* -------------------------------------------------------------- frame -- */

  update(dt, ctx) {
    if (this.state === 'play' && !this.paused) {
      const ui = ctx.get('ui');
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      ui.setMatch({ timeLeft: this.timeLeft });
      if (ui.state.scoreUs >= KILL_TARGET) {
        this._end(true);
        return;
      }
      if (this.timeLeft <= 0) {
        this._end(false);
        return;
      }
      this._recycleDead(ctx);
      this._reinforce(ctx);
    } else if (this.state === 'kia') {
      this.kiaT -= dt;
      setText(this.kiaCount, String(Math.max(1, Math.ceil(this.kiaT))));
      if (this.kiaT <= 0) this._respawn();
    }
  }

  /** Bound a long session: settled corpses (ragdoll + hitboxes + skinned mesh)
   *  are disposed once the garrison grows past a sane size. */
  _recycleDead(ctx) {
    const ai = ctx.peek('ai');
    if (!ai || ai.agents.length <= 8) return;
    for (let i = ai.agents.length - 1; i >= 0; i--) {
      const a = ai.agents[i];
      if (!a.alive && (a.deadTime ?? 0) > 10) {
        a.dispose?.();
        ai.agents.splice(i, 1);
        for (const s of ai.squads) {
          const k = s.members.indexOf(a);
          if (k >= 0) s.members.splice(k, 1);
        }
      }
    }
  }

  /** Keep the firefight alive: top up the garrison when it runs thin. */
  _reinforce(ctx) {
    const ai = ctx.peek('ai');
    if (!ai || !ai.grid) return;
    const alive = ai.stats?.alive ?? 0;
    if (alive > REINFORCE_WHEN_ALIVE) return;
    if (ctx.time.elapsed - this.lastReinforce < REINFORCE_COOLDOWN) return;
    this.lastReinforce = ctx.time.elapsed;
    const made = ai.populate({ squads: 1, perSquad: 3 });
    if (made > 0) {
      ctx.get('ui').banner.show('REINFORCEMENTS INBOUND', 'Hostiles approaching from the outskirts', 2.2);
    }
  }

  dispose() {
    for (const off of this._offs ?? []) off();
    window.removeEventListener('langchange', this._onLang);
    this.title?.remove();
    this.kia?.remove();
    this.end?.remove();
    this._style?.remove();
  }
}