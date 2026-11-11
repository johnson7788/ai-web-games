import { NET_CONFIG } from '../../config/net.config.js';

export class SnapshotBuffer {
  constructor(delayMs = NET_CONFIG.interpolationDelayMs, limit = NET_CONFIG.snapshotLimit) {
    this.delayMs = delayMs;
    this.limit = limit;
    this.frames = [];
  }

  push(snapshot, receivedAt = performance.now()) {
    const frame = { ...snapshot, receivedAt: snapshot.serverTime ?? receivedAt };
    const previous = this.frames.at(-1);
    if (previous && snapshot.tick < previous.tick) this.frames.length = 0;
    this.frames.push(frame);
    if (this.frames.length > this.limit) this.frames.splice(0, this.frames.length - this.limit);
  }

  sample(now = performance.now()) {
    if (!this.frames.length) return null;
    const target = now - this.delayMs;
    while (this.frames.length > 2 && this.frames[1].receivedAt <= target) this.frames.shift();
    const from = this.frames[0];
    const to = this.frames[1] ?? from;
    const span = to.receivedAt - from.receivedAt;
    const alpha = to === from || span <= 0 ? 0 : Math.max(0, Math.min(1, (target - from.receivedAt) / span));
    return { from, to, alpha };
  }

  clear() {
    this.frames.length = 0;
  }

  get latest() {
    return this.frames.at(-1) ?? null;
  }
}

const blankInput = () => ({
  mx: 0, mz: 0, jump: false, dash: false, punch: false,
  punchHeld: false, punchRelease: false, grab: false, charge: false,
});

export function createNet({
  url,
  storage = localStorage,
  WebSocketImpl = WebSocket,
  now = () => performance.now(),
  config = NET_CONFIG,
} = {}) {
  const listeners = new Map();
  const buffer = new SnapshotBuffer(config.interpolationDelayMs, config.snapshotLimit);
  let socket = null;
  let profile = { name: 'Player', char: 'shiba' };
  let token = null;
  let playerId = null;
  let room = null;
  let latestSnapshot = null;
  let ping = null;
  let sequence = 0;
  let inputProvider = null;
  let inputTimer = null;
  let pingTimer = null;
  let reconnectTimer = null;
  let reconnectStarted = 0;
  let reconnectDelay = 400;
  let attempt = 0;
  let manuallyClosed = false;
  let welcomed = false;
  let pendingWelcome = null;
  let freshHello = false;
  let state = 'idle';

  try { token = storage.getItem(config.storageKey); } catch {}

  function on(type, callback) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(callback);
    return () => listeners.get(type)?.delete(callback);
  }

  function emit(type, payload) {
    for (const callback of listeners.get(type) ?? []) callback(payload);
  }

  function setState(next, detail = {}) {
    state = next;
    emit('status', {
      state,
      attempt,
      elapsed: reconnectStarted ? Math.max(0, Math.floor((now() - reconnectStarted) / 1000)) : 0,
      ...detail,
    });
  }

  function saveToken(value) {
    token = value || null;
    try {
      if (token) storage.setItem(config.storageKey, token);
      else storage.removeItem(config.storageKey);
    } catch {}
  }

  function send(type, payload = {}) {
    if (socket?.readyState !== WebSocketImpl.OPEN) return false;
    socket.send(JSON.stringify({ type, ...payload }));
    return true;
  }

  function clearIntervals() {
    clearInterval(inputTimer);
    clearInterval(pingTimer);
    inputTimer = null;
    pingTimer = null;
  }

  function startIntervals() {
    clearIntervals();
    inputTimer = setInterval(() => {
      if (!inputProvider) return;
      const input = inputProvider() ?? blankInput();
      if (send('input', { seq: sequence, ...blankInput(), ...input })) sequence += 1;
    }, config.inputIntervalMs);
    pingTimer = setInterval(() => send('ping', { t: now() }), config.pingIntervalMs);
    send('ping', { t: now() });
  }

  function scheduleReconnect() {
    if (manuallyClosed) return;
    if (!reconnectStarted) reconnectStarted = now();
    if (now() - reconnectStarted >= config.reconnectWindowMs) {
      setState('offline');
      return;
    }
    attempt += 1;
    setState(welcomed ? 'reconnecting' : 'connecting');
    reconnectTimer = setTimeout(() => open(), reconnectDelay);
    reconnectDelay = Math.min(config.reconnectMaxDelayMs, reconnectDelay * 1.7);
  }

  function handleMessage(message) {
    if (!message || typeof message.type !== 'string') return;
    if (message.type === 'welcome') {
      welcomed = true;
      playerId = message.playerId ?? null;
      room = message.room ?? null;
      saveToken(message.token);
      reconnectStarted = 0;
      reconnectDelay = 400;
      attempt = 0;
      setState('online');
      freshHello = false;
      emit('welcome', message);
      const action = pendingWelcome;
      pendingWelcome = null;
      action?.();
      return;
    }
    if (message.type === 'snapshot') {
      latestSnapshot = message;
      buffer.push(message, now());
    } else if (message.type === 'pong') {
      ping = Math.max(0, Math.round(now() - message.t));
    } else if (message.type === 'error' && message.code === 'INVALID_TOKEN') {
      saveToken(null);
      socket?.close();
      return;
    }
    emit(message.type, message);
  }

  function open() {
    clearTimeout(reconnectTimer);
    clearIntervals();
    manuallyClosed = false;
    setState(reconnectStarted ? 'reconnecting' : 'connecting');
    const previous = socket;
    socket = null;
    previous?.close();
    const current = new WebSocketImpl(url);
    socket = current;
    current.addEventListener('open', () => {
      if (socket !== current) return;
      const hello = { name: profile.name, char: profile.char };
      if (!freshHello && token) hello.token = token;
      send('hello', hello);
      startIntervals();
    });
    current.addEventListener('message', (event) => {
      if (socket !== current) return;
      try { handleMessage(JSON.parse(event.data)); }
      catch { emit('error', { code: 'INVALID_JSON', message: 'Invalid server message' }); }
    });
    current.addEventListener('close', () => {
      if (socket !== current) return;
      clearIntervals();
      scheduleReconnect();
    });
    current.addEventListener('error', () => {});
  }

  function connect(nextProfile = {}) {
    profile = { ...profile, ...nextProfile };
    pendingWelcome = null;
    freshHello = false;
    reconnectStarted = now();
    welcomed = false;
    open();
  }

  function retry() {
    clearTimeout(reconnectTimer);
    reconnectStarted = now();
    reconnectDelay = 400;
    attempt = 0;
    open();
  }

  function createFresh(mode, char) {
    pendingWelcome = () => send('create', { mode, char });
    freshHello = true;
    welcomed = false;
    reconnectStarted = now();
    reconnectDelay = 400;
    attempt = 0;
    open();
  }

  function leave() {
    inputProvider = null;
    pendingWelcome = null;
    freshHello = false;
    latestSnapshot = null;
    buffer.clear();
    room = null;
    playerId = null;
    return send('leave');
  }

  function close() {
    manuallyClosed = true;
    clearTimeout(reconnectTimer);
    clearIntervals();
    socket?.close();
  }

  return {
    on, connect, retry, leave, close, send, createFresh,
    create: (mode, char) => send('create', { mode, char }),
    join: (code, name, char) => send('join', { code, name, char }),
    ready: (value) => send('ready', { value }),
    start: () => send('start'),
    setProfile: (next) => { profile = { ...profile, ...next }; },
    setInputProvider: (provider) => { inputProvider = provider; },
    get buffer() { return buffer; },
    get latestSnapshot() { return latestSnapshot; },
    get playerId() { return playerId; },
    get fighterId() { return playerId ? `f${playerId.slice(1)}` : null; },
    get room() { return room; },
    get token() { return token; },
    get ping() { return ping; },
    get sequence() { return sequence; },
    get state() { return state; },
    get connected() { return socket?.readyState === WebSocketImpl.OPEN && state === 'online'; },
  };
}
