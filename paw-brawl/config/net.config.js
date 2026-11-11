export const NET_CONFIG = {
  localUrl: 'ws://127.0.0.1:8601/ws',
  deployedUrl: 'wss://forty-segments-than-adding.trycloudflare.com/ws',
  inputIntervalMs: 33,
  pingIntervalMs: 2000,
  interpolationDelayMs: 100,
  reconnectWindowMs: 30_000,
  reconnectMaxDelayMs: 2000,
  snapshotLimit: 40,
  storageKey: 'pawbrawl_online_token_v1',
  profileKey: 'pawbrawl_online_profile_v1',
};

export function resolveServerUrl(search = '', locationLike = location) {
  const override = new URLSearchParams(search).get('server');
  if (override) {
    return locationLike.protocol === 'https:' && override.startsWith('ws://') ? `wss://${override.slice(5)}` : override;
  }
  // 同源直连页（8600）走 ws，低延迟；本地开发走 8601；HTTPS 页面用隧道 wss（较慢的备选）
  if (locationLike.protocol === 'http:') return NET_CONFIG.localUrl;
  return NET_CONFIG.deployedUrl;
}
