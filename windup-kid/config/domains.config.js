// 域名白名单：不在名单内的域名 3 秒后跳转
export const DOMAIN = {
  allowed: ['localhost', '127.0.0.1', '::1', 'pipygames.com', 'www.pipygames.com'],
  redirect: 'https://pipygames.com',
  delayMs: 3000,
  allowFile: true,      // file:// 开发时放行
  debugBypass: false,   // 本地调试可置 true 直接跳过
};
