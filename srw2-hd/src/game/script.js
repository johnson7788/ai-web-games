/**
 * src/game/script.js — 章节剧情台本加载（只读 data/script-zh.json）
 *
 * 数据结构（由 tools/scrape_script.py 生成）：
 *   { "01": { "title": "…", "lines": [{ "who": "ブライト", "whoZh": "乔",
 *                                       "text": "…", "textZh": "…" }] } }
 *
 * 日文台词仅在中文缺失时兜底；英文模式暂不播放剧情（简报仍是双语）。
 */

const SPEAKER_SPRITES = {
  乔: "whitebase", 布莱特: "whitebase", 布莱德: "whitebase",
  阿姆罗: "gundam", 卡缪: "zeta", 捷多: "zz", 西布克: "f91",
  甲儿: "mazinger", 铁也: "great", 大介: "grendizer",
  龙马: "getter", 隼人: "getter", 武藏: "getter", 一矢: "daitarn",
  爱美神: "aphrodite", 沙也加: "aphrodite", 由美: "metz", 美塔斯: "metz",
  杰克: "texas", 波士: "bosses", 正树: "cybuster",
  凤: "psyco", 普露: "quin", 普露茨: "quin", 哈曼: "quin", 西洛克: "gio",
  夏亚: "zakuChar", 拉拉: "elmes", 德兹尔: "bigzam", 比安: "valshione",
  塞西莉: "beguina", 罗莎米娅: "psyco2", 卡罗佐: "rafflesia", 格雷米: "bau",
  马·库贝: "gyan", 米涅瓦: "minervaX", 胡蝶: "monster", 拉德拉: "sig"
};

let cache = null;
let loading = null;

async function loadAll() {
  if (cache) return cache;
  if (loading) return loading;
  loading = fetch("data/script-zh.json", { cache: "force-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((json) => {
      cache = json || {};
      return cache;
    })
    .finally(() => { loading = null; });
  return loading;
}

/** 返回该话可播放的对话行；没有台本返回 []。 */
export async function chapterScript(chapter, lang = "zh") {
  if (lang !== "zh") return [];
  const key = String(chapter).padStart(2, "0");
  const all = await loadAll();
  const scene = all[key];
  if (!scene || !Array.isArray(scene.lines)) return [];
  const out = [];
  for (const line of scene.lines) {
    const who = line.whoZh || line.who || "";
    const raw = (line.textZh || line.text || "")
      .trim()
      .replace(/^[「『]/, "")
      .replace(/[」』]$/, "");
    if (!raw) continue;
    // 原站按画面宽度断行，常把一句话拆成 2~4 段；同说话人短句合并，减少点击。
    const chunks = raw.length > 120 ? raw.match(/.{1,60}/g) : [raw];
    for (const chunk of chunks) {
      const last = out[out.length - 1];
      if (last && last.who === who && last.text.length + chunk.length <= 52) {
        const glue = /[。！？…」】]$/.test(last.text) ? "" : "，";
        last.text += glue + chunk;
      } else {
        out.push({ who, sprite: SPEAKER_SPRITES[who] || "whitebase", text: chunk });
      }
    }
  }
  return out;
}

export function hasSpeaker(name) {
  return !!SPEAKER_SPRITES[name];
}
