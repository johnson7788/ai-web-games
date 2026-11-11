// 域名锁：非白名单 → 倒计时覆盖层 → 跳转
import { DOMAIN } from '../../config/domains.config.js';
import { t } from './i18n.js';

const $ = (id) => document.getElementById(id);

/** 纯函数：某个 host 是否在白名单（便于单测） */
export function isAllowedHost(host, protocol = 'https:') {
  if (protocol === 'file:' && DOMAIN.allowFile) return true;
  if (!host) return true;
  return DOMAIN.allowed.includes(host);
}

export function guardDomain() {
  if (DOMAIN.debugBypass) return false;
  if (isAllowedHost(location.hostname, location.protocol)) return false;

  const box = $('scr-lock');
  const msgEl = $('lockMsg');
  box.classList.remove('hidden');
  let left = Math.ceil(DOMAIN.delayMs / 1000);
  msgEl.textContent = t('lockMsg', { s: left });
  const timer = setInterval(() => {
    left -= 1;
    msgEl.textContent = t('lockMsg', { s: Math.max(0, left) });
    if (left <= 0) {
      clearInterval(timer);
      location.replace(DOMAIN.redirect);
    }
  }, 1000);
  return true;
}
