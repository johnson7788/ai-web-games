import { t } from './i18n/i18n.ts';
import { initAudio } from './audio.ts';
import { Profile, setProfileStorage, type ProfileData, type ProfileStorage } from './items.ts';
import { runPlayground } from './dev/playground.ts';
import './fonts.css';
import './menu/menu.css';
import './solo.css';

/**
 * Solo entry of the pipygames edition: a title screen, then the Bush Defence battle simulated entirely in this page
 * (src/sim/td.ts via src/dev/playground.ts). No server, no sockets — the upstream network layer is stripped.
 * The hero profile lives in localStorage when available, in memory otherwise (sandboxed iframes).
 */

const STORE_KEY = 'malina.solo.profile';

/** Local profile storage: localStorage with a memory fallback (opaque-origin iframes throw on access) */
class LocalProfileStore implements ProfileStorage {
  private mem: ProfileData | null = null;
  constructor() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) this.mem = JSON.parse(raw) as ProfileData;
    } catch { /* closed storage — memory only */ }
  }
  stored(): ProfileData | null { return this.mem; }
  update(f: (d: ProfileData) => void): void {
    const d = this.mem ? structuredClone(this.mem) : Profile.starter();
    f(d);
    this.mem = d;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch { /* memory only */ }
  }
}

/** The title screen: logo, goal, controls, credits; Start begins the defence */
function titleScreen(onStart: () => void): void {
  const el = document.createElement('div');
  el.className = 'solo-title';
  el.innerHTML = `
    <div class="solo-card">
      <div class="solo-logo">MALINA<small>${t('Bush Defence')}</small></div>
      <p class="solo-tag">${t('The Order marches on the raspberry bush. Build towers on the pads, fight at its side and hold all 10 waves.')}</p>
      <button class="mm-btn big primary solo-start" data-act="start">${t('Start Defence')} <kbd>Enter</kbd></button>
      <div class="solo-controls">
        <b>${t('Controls')}</b>
        <span><kbd>WASD</kbd> ${t('move')} · <kbd>LMB</kbd> ${t('walk / strike')} · <kbd>Space</kbd> ${t('dodge roll')}</span>
        <span><kbd>F</kbd> ${t('build / upgrade / sell at a pad')} · <kbd>1–8</kbd> ${t('pick a tower')}</span>
        <span><kbd>G</kbd> ${t('call the next wave early (+bonus)')} · <kbd>RMB</kbd> ${t('bow')} · <kbd>E</kbd> ${t('potion')}</span>
        <span><kbd>I</kbd> ${t('inventory')} · <kbd>M</kbd> ${t('map')} · <kbd>Esc</kbd> ${t('pause')}</span>
      </div>
      <p class="solo-credit">${t('Based on')} <a href="https://github.com/aablinov/malina" target="_blank" rel="noopener">malina</a> ${t('by aablinov (MIT)')} · ${t('single-player Bush Defence edition')}</p>
    </div>`;
  document.body.appendChild(el);
  let started = false;
  const go = (): void => {
    if (started) return;
    started = true;
    initAudio();
    el.remove();
    onStart();
  };
  el.querySelector('[data-act="start"]')?.addEventListener('click', go);
  window.addEventListener('keydown', (e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); go(); } });
}

function startBattle(): void {
  // the battle page reads its mode from the query: the Lava Basin defence, with the pause/result menu
  const u = new URL(window.location.href);
  u.search = '';
  u.searchParams.set('map', 'td');
  u.searchParams.set('from', 'menu');
  const lang = new URLSearchParams(window.location.search).get('lang');
  if (lang) u.searchParams.set('lang', lang);
  window.history.replaceState(null, '', u.toString());
  const store = new LocalProfileStore();
  setProfileStorage(store);
  const profile = new Profile(store.stored() ?? Profile.starter());
  runPlayground(profile);
}

// The kit language button reloads with ?lang= so every string (resolved at module load) switches too
window.addEventListener('langchange', (e) => {
  const lang = (e as CustomEvent<{ lang: string }>).detail?.lang;
  if (!lang) return;
  const u = new URL(window.location.href);
  u.searchParams.set('lang', lang);
  window.location.href = u.toString();
});

titleScreen(startBattle);