// 分享卡：把游戏画面 + 成绩画成 1200×630 卡片，优先走系统分享，否则下载
export async function makeCard(sourceCanvas, info) {
  const W = 1200, H = 630;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // 画面铺满（cover）
  if (sourceCanvas && sourceCanvas.width) {
    const sw = sourceCanvas.width, sh = sourceCanvas.height;
    const scale = Math.max(W / sw, H / sh);
    const dw = sw * scale, dh = sh * scale;
    ctx.drawImage(sourceCanvas, (W - dw) / 2, (H - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = '#1a2233';
    ctx.fillRect(0, 0, W, H);
  }

  // 压暗 + 品牌色渐变
  const g = ctx.createLinearGradient(0, H * 0.35, 0, H);
  g.addColorStop(0, 'rgba(8,10,16,0)');
  g.addColorStop(1, 'rgba(8,10,16,0.92)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#ffd98c';
  ctx.font = '700 64px "Avenir Next", "PingFang SC", system-ui, sans-serif';
  ctx.fillText('WIND-UP KID', 64, 96);

  ctx.fillStyle = 'rgba(255,233,196,.85)';
  ctx.font = '600 30px "Avenir Next", "PingFang SC", system-ui, sans-serif';
  ctx.fillText(`${info.levelId} · ${info.levelName}`, 66, 150);

  ctx.font = '700 92px "Avenir Next", system-ui, sans-serif';
  ctx.fillStyle = '#f2c879';
  ctx.fillText('★'.repeat(info.stars) + '☆'.repeat(3 - info.stars), 64, H - 150);

  ctx.font = '600 28px "Avenir Next", "PingFang SC", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,233,196,.8)';
  ctx.fillText(`${info.gears}/${info.total} gears · ${info.deaths} deaths · ${info.time}s`, 66, H - 96);

  ctx.font = '600 24px "Avenir Next", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,233,196,.55)';
  ctx.fillText('pipygames.com', W - 260, H - 40);

  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  return { blob, canvas: c };
}

export async function shareCard(card, text) {
  const file = new File([card.blob], 'windup-kid.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, title: 'WIND-UP KID' });
      return 'shared';
    } catch { /* 用户取消或失败，落回下载 */ }
  }
  const url = URL.createObjectURL(card.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'windup-kid.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}
