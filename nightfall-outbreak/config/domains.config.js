// config/domains.config.js — 域名锁唯一权威配置
// 规格：仅 localhost、pipygames.com 可正常运行；其他域名打开 3 秒后自动跳转 pipygames.com。
// 任何改「白名单 / 跳转地址 / 等待时长」的需求都改这里，不要散落到 src/。
export const DOMAINS = {
  // 放行域名（按 host 精确匹配；localhost / 127.0.0.1 视为本地调试）
  allowed: ["pipygames.com", "localhost", "127.0.0.1"],
  // 命中未授权域名后跳转的目标
  redirect: "https://pipygames.com/",
  // 未授权域名下运行多久后跳转（毫秒）——规格固定 3000，不要改成 0 或直接跳
  delay: 3000,
  // 子域放行规则：www.pipygames.com 放行，其它任意子域同样按主域匹配
  allowSubdomains: true
};
