// src/main.js — boot: load Ammo (inlined wasm), start game, wire UI.
import { BowlingGame } from './game/game.js';

function b64ToBytes(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const $ = (id) => document.getElementById(id);
const screens = ['screen-title', 'screen-pause', 'screen-results'];

function showScreen(id) {
  for (const s of screens) { const el = $(s); if (el) el.classList.toggle('is-active', s === id); }
}
function showHowto(on) { const el = $('howto'); if (el) el.classList.toggle('is-active', on); }

// Authoritative localization for static data-i18n elements (key-based), supplementing
// the kit's text-node matcher. Re-applied on language change.
function applyI18n() {
  if (!window.I18N) return;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const k = el.getAttribute('data-i18n');
    const v = window.I18N.t(k);
    if (v != null && el.textContent !== v) el.textContent = v;
  });
}

async function loadAmmo() {
  const bytes = b64ToBytes(window.__AMMO_WASM_B64);
  const factory = window.Ammo;
  const mod = await factory({ wasmBinary: bytes });
  window.Ammo = (mod && mod.btVector3) ? mod : window.Ammo;
  if (typeof window.Ammo.btVector3 !== 'function') throw new Error('Ammo failed to initialize');
}

async function boot() {
  const loading = $('loading');
  try {
    await loadAmmo();
  } catch (e) {
    if (loading) loading.innerHTML = '<div class="load-err">Failed to load physics engine.<br>Please refresh.</div>';
    console.error(e);
    return;
  }
  if (loading) loading.classList.add('hidden');

  const game = new BowlingGame($('canvas'));
  window.__game = game; // exposed for smoke testing / debugging

  game.onState = (state) => {
    const hud = $('hud');
    if (state === 'title') { showScreen('screen-title'); if (hud) hud.classList.add('hidden'); showHowto(false); }
    else if (state === 'paused') { showScreen('screen-pause'); }
    else if (state === 'gameover') { showScreen('screen-results'); if (hud) hud.classList.add('hidden'); }
    else { showScreen(null); if (hud) hud.classList.remove('hidden'); }
  };

  await game.init();
  game.onState('title');
  applyI18n();

  const t = (k) => window.I18N ? window.I18N.t(k) : k;

  // buttons
  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', () => { game.audio.ensure(); game.audio.click(); fn(); }); };
  on('btn-start', () => { game.startGame(); });
  on('btn-howto', () => showHowto(true));
  on('btn-howto-close', () => showHowto(false));
  on('btn-resume', () => game.resume());
  on('btn-restart-pause', () => { game.resume(); game.startGame(); });
  on('btn-menu-pause', () => game.toMenu());
  on('btn-restart', () => game.startGame());
  on('btn-menu', () => game.toMenu());
  on('btn-share', () => { if (window.PipySDK) window.PipySDK.share({ title: 'Pin Smash', text: 'I scored ' + game.best + ' in Pin Smash! Can you beat it?' }); });

  const muteBtn = $('btn-mute');
  const syncMute = () => { if (muteBtn) muteBtn.textContent = t(game.audio.muted ? 'SOUND: OFF' : 'SOUND: ON'); };
  if (muteBtn) muteBtn.addEventListener('click', () => { game.toggleMute(); syncMute(); });
  syncMute();
  window.addEventListener('langchange', () => { applyI18n(); syncMute(); game._updateBestUI(); });

  // pause button in HUD
  on('btn-pause', () => game.togglePause());
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();