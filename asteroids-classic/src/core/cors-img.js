// src/core/cors-img.js — 沙箱 iframe 纹理兼容补丁（改造批）
// pipygames 线上 iframe 无 allow-same-origin → origin 为 'null'（opaque），
// 所有 <img> 都算跨域，WebGL texImage2D 会因 canvas 污染抛错。
// 资源服务器带 Access-Control-Allow-Origin: *，故给 img 设 crossOrigin='anonymous' 即可。
// 仅在 opaque origin 下生效；本地/普通域名不受影响（本地服务器无 CORS 头，设了反而加载失败）。
(function () {
  'use strict';
  var opaque = false;
  try { opaque = (window.origin === 'null' || location.origin === 'null'); } catch (e) { opaque = true; }
  if (!opaque) return;
  var origNS = document.createElementNS.bind(document);
  document.createElementNS = function (ns, tag) {
    var el = origNS(ns, tag);
    try { if (String(tag).toLowerCase() === 'img') el.crossOrigin = 'anonymous'; } catch (e) { /* noop */ }
    return el;
  };
  var origCE = document.createElement.bind(document);
  document.createElement = function (tag, opts) {
    var el = origCE(tag, opts);
    try { if (String(tag).toLowerCase() === 'img') el.crossOrigin = 'anonymous'; } catch (e) { /* noop */ }
    return el;
  };
  var OrigImage = window.Image;
  window.Image = function (w, h) {
    var img = (w !== undefined) ? new OrigImage(w, h) : new OrigImage();
    try { img.crossOrigin = 'anonymous'; } catch (e) { /* noop */ }
    return img;
  };
  window.Image.prototype = OrigImage.prototype;
})();