// src/core/domainlock.js — 域名锁：仅 localhost / pipygames.com 运行，其余 3 秒跳站
// 配置唯一来源 config/domains.config.js（白名单 / 跳转地址 / 等待时长都在那里）。
import { DOMAINS } from "config/domains.config.js";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", ""]);

function normalize(host) {
  return String(host || "").toLowerCase().replace(/^www\./, "");
}

export function isAllowedHost(host) {
  const h = normalize(host);
  if (LOCAL_HOSTS.has(h)) return true;
  const allowed = (DOMAINS.allowed || []).map(normalize);
  if (allowed.includes(h)) return true;
  if (DOMAINS.allowSubdomains) {
    return allowed.some((a) => a && h.endsWith("." + a));
  }
  return false;
}

/**
 * 执行域名锁。
 * @param {(delayMs:number)=>void} [onBlocked] 未授权时的可见提示回调（不阻断、不弹框）
 * @returns {boolean} 当前域名是否被放行
 */
export function enforceDomainLock(onBlocked) {
  let host = "";
  try { host = location.hostname; } catch (_) { host = ""; }

  // file:// 直开视作本地调试
  if (location.protocol === "file:" || isAllowedHost(host)) return true;

  const delay = Number(DOMAINS.delay) > 0 ? Number(DOMAINS.delay) : 3000;
  if (onBlocked) onBlocked(delay);
  setTimeout(() => { location.replace(DOMAINS.redirect || "https://pipygames.com/"); }, delay);
  return false;
}
