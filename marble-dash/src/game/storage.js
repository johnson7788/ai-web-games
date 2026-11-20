// Marble Dash — persistence: PipySDK first, localStorage fallback, memory last.
// All access wrapped: sandboxed iframes (opaque origin) may throw on localStorage.
const KEY = 'marble-dash:save';
let mem = null;

export function loadSave() {
  try {
    if (window.PipySDK) {
      const v = window.PipySDK.load('save', null);
      if (v && typeof v === 'object') return v;
    }
  } catch (e) { /* opaque origin */ }
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) { const v = JSON.parse(raw); if (v && typeof v === 'object') return v; }
  } catch (e) { /* opaque origin */ }
  return mem;
}

export function persistSave(obj) {
  mem = obj;
  try { if (window.PipySDK) window.PipySDK.save('save', obj); } catch (e) { /* noop */ }
  try { window.localStorage.setItem(KEY, JSON.stringify(obj)); } catch (e) { /* noop */ }
}