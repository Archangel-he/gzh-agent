# 标题海报规格（双轨交付）

> 前提（不可改写）：
> 1. 生图模型渲染中文标题不可靠（错字、缺笔画），因此中文标题绝不由生图模型生成。
> 2. 文章 HTML 里的 `<img>` 只接受 `asset://<素材ID>` 或已注册的 `assets/<file>`；`https` 外链和本地路径都会校验失败。
> 3. 公众号编辑器接受手动拖入的图片文件（会自动上传），不接受本地路径。
> 4. 位置固定为：首图之后、正文之前；视觉上必须突出「标题 + 副标题」。
>
> 标签和 CSS 白名单见 [wechat-constraints.md](./wechat-constraints.md)，HTML 标题卡的通用做法见 [title-card.md](./title-card.md)。本文不建议修改任何白名单。

## 一、视觉方向（2 个）

两种方向共用三种画布：正文 677×300（约 2.26:1）、封面 2.35:1（900×383）、封面 1:1（200×200）。方向差异在构图、色块和留白，不在画布比例。

### 1.1 方向 A：大字号极简

- **画布比例**：正文 677×300；封面 2.35:1；封面 1:1。
- **主色 / 辅色推导**：背景用主题 `tint`，标题、小标签和细线用主题 `color`；不额外引入彩色。主题色很浅时，改用白色/极浅底 + 深色字，保证对比。
- **留白比例**：文字约占画面 30–35%，留白 65–70%；文字靠左，右侧或底部只留一块小几何色块/细线。
- **字重与字距**：标题 600–700，字距 1–1.5px 或 0.02–0.05em；小标签 600，字距 3px；副标题 400，字距 0.5px。
- **装饰元素**：只用一块矩形色块或一条细线，不画具象图形、人物、风景或图标。
- **适合标题**：8–20 字，副标题可有可无；标题长、需要安静阅读感时优先；没有副标题也能成立。
- **不适合**：需要大面积品牌色、需要强视觉冲击的封面；需要文字压图时改走 PNG 路线。

### 1.2 方向 B：色块 + 副标题

- **画布比例**：正文 677×300；封面 2.35:1；封面 1:1。
- **主色 / 辅色推导**：大面积色块用主题 `color`，标题用 `#ffffff`，副标题和小标签用主题 `tint`；主题色很浅时反色：色块用 `tint`，文字用 `color`。
- **留白比例**：色块占画面高约 65–78%，色块内文字区留出 10–14% 的内边距；色块外留白 22–35%。
- **字重与字距**：标题 700，字距 0.5–1px；小标签 600，字距 2px；副标题 400，字距 0.5px。
- **装饰元素**：色块本身 + 一条细线（也可以只用色块），不画具象图形。
- **适合标题**：6–14 字，必须配 1 句副标题；标题短、需要封面冲击力时优先；色块能承载白色标题。
- **不适合**：标题很长（超过 14 字）且不愿意降字号；主题色很浅且未做反色。

## 二、图层拆分（关键）

> 这一节主要描述 PNG 路线。HTML 路线没有可用的图片底图层：`background-image` 不在允许清单，`<img>` 又不能稳定承载文字；HTML 的底图层只能降级为 CSS 色块和细线（见第四部分 A）。

成品固定拆成两层，合成顺序是「底图层 → 文字层」：

1. **底图层**：由生图模型生成，只包含背景、几何色块和细线；不能有任何文字。
2. **文字层**：由代码绘制，只包含小标签、主标题、副标题；绝不经过生图模型。

### 2.1 底图层：生图提示词模板

**硬规则：生图模型的输出里不能有任何文字，否则中文会乱。** 生成后要人工放大检查；发现汉字、字母、数字、标点、logo、水印、签名或二维码，整张废弃重绘，不能靠后期涂抹或 OCR 修正。

中文模板：

```text
生成一张微信公众号文章的抽象几何背景底图，画布比例 {ratio}。
主色 {theme_color}，辅色 {tint_color}。
画面只允许纯色块、矩形、圆形、细线等几何元素；不要任何具象物体、人物、风景、图标或插画。
画面中绝对不要出现任何文字、汉字、字母、数字、标点、logo、水印、签名、二维码、UI 标签。
文字安全区 {text_area} 必须干净、低对比、留白充足，供后期叠加标题和副标题；视觉重心放在 {accent_area}。
扁平、干净、印刷感、边缘清晰、无噪点；不要生成文字排版。
```

English template:

```text
Create an abstract geometric background for a WeChat article title poster, aspect ratio {ratio}.
Primary color {theme_color}, secondary color {tint_color}.
Use only flat geometric shapes: rectangles, circles, thin lines, and color fields. No objects, people, landscapes, icons, or illustrations.
Absolutely no text, no Chinese characters, no letters, no numbers, no punctuation, no logos, no watermarks, no signatures, no QR codes, no UI labels.
Keep the {text_area} area clean, low-contrast and spacious for a title and subtitle overlay; place the visual accent in {accent_area}.
Flat, clean, print-like, crisp edges, no noise, no text layout.
```

负向提示词（如果服务支持；是否支持未确认）：

```text
text, Chinese characters, letters, numbers, punctuation, logo, watermark, signature, QR code, UI, typography, caption
```

占位符取值：

| 占位符 | 方向 A（大字号极简） | 方向 B（色块 + 副标题） |
|---|---|---|
| `{ratio}` | `677:300` 或 `900:383` 或 `1:1` | 同上 |
| `{theme_color}` | 主题 `color`，如 `#174c43` | 主题 `color`，如 `#174c43` |
| `{tint_color}` | 主题 `tint`，如 `#edf3ef` | 主题 `tint`，如 `#edf3ef` |
| `{text_area}` | 画面左侧 8%–92% 宽、上方 10%–80% 高的文字区 | 中央偏左 14%–86% 宽、18%–80% 高的文字区，位于大色块内 |
| `{accent_area}` | 右侧约 20% 宽或底部 8% 高的小色块/细线 | 左侧或底部的大色块边缘 |

方向 B 的大色块也可以由代码直接绘制；如果底图已经包含色块，文字层直接叠字，不要重复画。

### 2.2 文字层：代码绘制规格

位置都以画布左上角为原点，`x`/`y` 是画布宽/高的百分比；`最大宽度` 也是画布宽的百分比。

**方向 A（大字号极简）**

| 元素 | 字号（正文 677×300 / 封面 900×383 / 1:1 200×200） | 行高 | 字距 | 颜色 | 位置（x, y） | 最大宽度 / 行数 |
|---|---|---|---|---|---|---|
| 小标签（可选） | 12 / 13 / 9px | 1.6 | 3 / 3 / 2px | 主题 `color` | 8%, 10% | 60% 宽，1 行 |
| 主标题 | 42 / 56 / 22px | 1.3 | 1 / 1.5 / 0.5px | 主题 `color` | 8%, 20% | 84% 宽，最多 2 行 |
| 副标题 | 15 / 20 / 11px | 1.8 | 0.5px | 主题 `color` 或中性深灰 | 8%, 68% | 84% 宽，最多 2 行 |

方向 A 的装饰：底图层画一条细线或一块小色块，位置约 `x 8%, y 62%, 宽 8%, 高 2px`，颜色用主题 `color`；不要让它压住标题或副标题。

**方向 B（色块 + 副标题）**

| 元素 | 字号（正文 677×300 / 封面 900×383 / 1:1 200×200） | 行高 | 字距 | 颜色 | 位置（x, y） | 最大宽度 / 行数 |
|---|---|---|---|---|---|---|
| 小标签（可选） | 12 / 13 / 9px | 1.6 | 2 / 2 / 1.5px | 主题 `tint` | 14%, 18% | 72% 宽，1 行 |
| 主标题 | 34 / 50 / 21px | 1.35 | 0.5 / 1 / 0.5px | `#ffffff` | 14%, 28% | 72% 宽，最多 2 行 |
| 副标题 | 15 / 20 / 10px | 1.8 | 0.5px | 主题 `tint` | 14%, 64% | 72% 宽，最多 2 行 |

方向 B 的色块：底图层绘制，位置约 `x 8%, y 10%, 宽 84%, 高 78%`；主题色很浅时反色（色块 `tint`，文字 `color`）。

**最长标题的折行规则**

| 画布 | 标题最大宽度（方向 A / 方向 B） | 估计每行汉字数（A / B） | 最多行数 | 超出时怎么处理 |
|---|---|---|---|---|
| 677×300 | 569px / 487px | 13 / 14 | 2 | A：42→40→38→36→34px；B：34→32→30px；仍超出就增高到 340px 或缩短标题 |
| 900×383 | 756px / 648px | 13 / 12 | 2 | A：56→52→48px；B：50→46→42px；仍超出就缩短标题 |
| 200×200 | 168px / 144px | 7 / 6 | 2 | A：22→20→18px；B：21→19→17px；仍超出就改用 2.35:1 或缩短标题 |

- 汉字宽度约等于字号；英文和数字用 `measureText` 实际测量，不要按字数硬算。
- 不截断、不加省略号；宁可降字号、增高画布或请用户缩短标题。
- 标题、副标题、细线都不得贴边；底部安全边界约画布高的 8–12%。

## 三、尺寸规格

| 用途 | 逻辑像素 | 2x 导出 | 比例 | 说明 |
|---|---|---|---|---|
| 正文内嵌图（与公众号正文同宽） | 677 × 300 | 1354 × 600 | 约 2.26:1 | 677px 是桌面编辑器常用正文宽度；高度可在 260–320px 调整 |
| 公众号封面 2.35:1 | 900 × 383 | 1800 × 766 | 2.35:1 | 头条封面常用规格；以后台预览为准 |
| 公众号封面 1:1 | 200 × 200 | 400 × 400 | 1:1 | 小图/次条封面常用；可用 2x 源图保证清晰 |

677px 是否为所有客户端的正文宽度未确认；900×383、200×200 的后台裁剪和压缩行为未确认。

### 同一份底图 + 文字层如何复用

| 画布 | 底图层 | 文字层 |
|---|---|---|
| 正文 677×300 | 默认按 677:300 重新生成；只有 2.35:1 底图的几何元素都远离边缘时，才考虑轻微裁切复用（可用性未确认） | 重排：方向 A 42px 标题、方向 B 34px 标题；按上表百分比重新计算 |
| 封面 2.35:1 900×383 | 按 900:383 单独生成 | 重排：方向 A 56px、方向 B 50px；不要直接缩放正文卡成品 |
| 封面 1:1 200×200 | 默认按 1:1 重新生成；不要直接中心裁切 2.35:1 底图 | 重排：方向 A 22px、方向 B 21px；1:1 的每行字数更少，必须重新折行 |

- 不能把一张成品 PNG 直接缩放到三种尺寸；文字会变糊，折行也会错。
- 1:1 从 2.35:1 裁切是否可用取决于构图，未确认；默认重绘。
- HTML 路线没有底图，CSS 色块和文字会随容器宽度自然重排，不需要导出三种 PNG。

## 四、交付路径（两条，都要）

### A. HTML 版：纯内联样式标题卡

**限制**：HTML 版只能用白名单标签和 CSS；`<img>` 保留安全的自定义内联样式；定位仍被限制，因此 HTML 版不依赖把生成的底图放在文字背后。需要「底图 + 文字」的视觉效果时走 PNG 路线。

以下片段放在首图之后、导语/正文之前；占位标题为「文章标题」。

**方向 A：大字号极简**

```html
<section style="background-color:#edf3ef;padding:48px 40px 44px;border-radius:2px;">
  <p style="margin:0 0 16px;color:#174c43;font-size:12px;font-weight:600;letter-spacing:3px;line-height:1.6;">
    <span leaf="">FIELD NOTES · 公众号排版</span>
  </p>
  <h1 style="margin:0;color:#174c43;font-size:40px;font-weight:700;letter-spacing:1px;line-height:1.3;">
    <span leaf="">文章标题</span>
  </h1>
  <p style="margin:16px 0 0;color:#174c43;font-size:14px;font-weight:400;letter-spacing:0.5px;line-height:1.8;">
    <span leaf="">副标题占位 · 一句话说明文章主题</span>
  </p>
  <section style="margin-top:28px;width:56px;height:6px;background-color:#174c43;border-radius:3px;"></section>
</section>
```

用到的 CSS 属性：`background-color`、`padding`、`border-radius`、`margin`、`color`、`font-size`、`font-weight`、`letter-spacing`、`line-height`、`margin-top`、`width`、`height`，均在允许清单内。

**方向 B：色块 + 副标题**

```html
<section style="background-color:#174c43;padding:44px 40px 40px;border-radius:4px;">
  <p style="margin:0 0 14px;color:#edf3ef;font-size:12px;font-weight:600;letter-spacing:2px;line-height:1.6;">
    <span leaf="">GZH AGENT · 设计说明</span>
  </p>
  <h1 style="margin:0;color:#ffffff;font-size:34px;font-weight:700;letter-spacing:0.5px;line-height:1.35;">
    <span leaf="">文章标题</span>
  </h1>
  <p style="margin:18px 0 0;color:#edf3ef;font-size:15px;font-weight:400;letter-spacing:0.5px;line-height:1.8;">
    <span leaf="">副标题占位 · 用一句话补充文章的核心信息</span>
  </p>
  <section style="margin-top:26px;width:100%;height:1px;border-top:1px solid #edf3ef;"></section>
</section>
```

用到的 CSS 属性：`background-color`、`padding`、`border-radius`、`margin`、`color`、`font-size`、`font-weight`、`letter-spacing`、`line-height`、`margin-top`、`width`、`height`、`border-top`，均在允许清单内。

**做不到的效果与允许范围内的替代**

| 想要的效果 | 结论 | 替代方案 |
|---|---|---|
| 生成的底图作为文字背景 | **做不到**：`background-image` 不在允许清单；不支持 background-image 与定位叠字 | 用纯色底 + 几何色块/细线；需要底图走 PNG 路线 |
| 文字阴影/发光 | **做不到**：`text-shadow` 不在允许清单 | 用更大字号、700 字重和颜色对比 |
| 盒子阴影 | **做不到**：`box-shadow` 不在允许清单 | 用 `border` 或色块分隔 |
| 整体透明度 | **做不到**：`opacity` 不在允许清单 | 用 `rgba(...)` 写 `color`/`background-color` |
| 绝对定位 / 文字压图 | **做不到**：`position` 会判错；`<img>` 不能承载文字 | 文字与图片上下排；需要压图走 PNG 路线 |
| 多栏 / flex / grid | `display:grid` 判错；`display:flex` 未拦截但微信兼容性未确认 | 用 `table` 或块级 `section` |
| 伪元素装饰 | **做不到**：内联 `style` 无法表达选择器；`<style>` 判错 | 用真实 `span`/`section` 元素 |
| 自定义字体/图标字体 | `font-family` 可写，但外部字体加载未确认 | 用系统字体栈 |
| 渐变背景 | `background-image` 不在清单；`background` 渐变渲染未确认 | 用纯色 `background-color` |

### B. PNG 版：canvas 绘制

> **由 P4 落地**：下面是参考实现，不是现在修改 `public/` 的补丁。P4 负责把底图加载、文字层绘制和导出接进实际前端。

```js
// 由 P4 落地：参考实现。
const THEMES = {
  editorial: { color: '#174c43', tint: '#edf3ef' },
  warm: { color: '#994d32', tint: '#faf0e6' },
  blue: { color: '#285e9c', tint: '#edf3fa' },
};

const FONT_STACK = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB","Segoe UI",sans-serif';

const LAYOUTS = {
  minimal: {
    eyebrow: { x: 0.08, y: 0.10, w: 0.60, size: [12, 13, 9], lineHeight: 1.6, spacing: [3, 3, 2], color: 'color' },
    title:   { x: 0.08, y: 0.20, w: 0.84, size: [42, 56, 22], lineHeight: 1.3, spacing: [1, 1.5, 0.5], color: 'color' },
    subtitle:{ x: 0.08, y: 0.68, w: 0.84, size: [15, 20, 11], lineHeight: 1.8, spacing: [0.5, 0.5, 0.5], color: 'color' },
    accent:  { x: 0.08, y: 0.62, w: 0.08, h: 2, color: 'color' },
  },
  block: {
    block:   { x: 0.08, y: 0.10, w: 0.84, h: 0.78, color: 'color' },
    eyebrow: { x: 0.14, y: 0.18, w: 0.72, size: [12, 13, 9], lineHeight: 1.6, spacing: [2, 2, 1.5], color: 'tint' },
    title:   { x: 0.14, y: 0.28, w: 0.72, size: [34, 50, 21], lineHeight: 1.35, spacing: [0.5, 1, 0.5], color: 'white' },
    subtitle:{ x: 0.14, y: 0.64, w: 0.72, size: [15, 20, 10], lineHeight: 1.8, spacing: [0.5, 0.5, 0.5], color: 'tint' },
  },
};

function sizeIndex(width) { return width <= 240 ? 2 : width >= 900 ? 1 : 0; }

function measureSpaced(ctx, text, spacing) {
  let width = 0;
  for (const ch of Array.from(text)) width += ctx.measureText(ch).width + spacing;
  return Math.max(0, width - spacing);
}

function wrapText(ctx, text, maxWidth, spacing) {
  const lines = [];
  let line = '';
  for (const ch of Array.from(text)) {
    const next = line + ch;
    if (line && measureSpaced(ctx, next, spacing) > maxWidth) {
      lines.push(line);
      line = ch;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fitText(ctx, text, maxWidth, maxLines, baseSize, lineHeightRatio, spacing, weight) {
  const minSize = Math.max(9, baseSize - 8);
  for (let size = baseSize; size >= minSize; size -= 2) {
    ctx.font = `${weight} ${size}px ${FONT_STACK}`;
    const lines = wrapText(ctx, text, maxWidth, spacing);
    if (lines.length <= maxLines) return { size, lines, lineHeight: size * lineHeightRatio, spacing };
  }
  throw new Error(`标题超过 ${maxLines} 行，请缩短标题或增高画布。`);
}

function drawSpaced(ctx, text, x, y, spacing) {
  let cursor = x;
  for (const ch of Array.from(text)) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + spacing;
  }
}

function drawCover(ctx, image, width, height) {
  const ratio = Math.max(width / image.width, height / image.height);
  const w = image.width * ratio;
  const h = image.height * ratio;
  ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
}

function drawTitlePoster({
  canvas, width, height, background = null, title, subtitle = '', eyebrow = '',
  theme = 'editorial', layout = 'minimal', scale = 2,
}) {
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.textBaseline = 'top';

  const t = THEMES[theme] || THEMES.editorial;
  const spec = LAYOUTS[layout] || LAYOUTS.minimal;
  const index = sizeIndex(width);
  const resolve = name => name === 'white' ? '#ffffff' : name === 'tint' ? t.tint : t.color;

  if (background) {
    drawCover(ctx, background, width, height);
  } else {
    ctx.fillStyle = layout === 'block' ? t.color : t.tint;
    ctx.fillRect(0, 0, width, height);
  }

  if (layout === 'block' && !background) {
    ctx.fillStyle = t.color;
    ctx.fillRect(width * spec.block.x, height * spec.block.y, width * spec.block.w, height * spec.block.h);
  }

  if (spec.accent) {
    ctx.fillStyle = resolve(spec.accent.color);
    ctx.fillRect(width * spec.accent.x, height * spec.accent.y, width * spec.accent.w, spec.accent.h);
  }

  const drawBlock = (element, text, weight, maxLines) => {
    if (!text) return;
    const baseSize = element.size[index];
    const spacing = element.spacing[index];
    const fitted = fitText(ctx, text, width * element.w, maxLines, baseSize, element.lineHeight, spacing, weight);
    const bottom = height * element.y + fitted.lines.length * fitted.lineHeight;
    if (bottom > height * 0.92) throw new Error('文字超出底部安全区，请降低字号或增高画布。');
    ctx.fillStyle = resolve(element.color);
    ctx.font = `${weight} ${fitted.size}px ${FONT_STACK}`;
    let y = height * element.y;
    for (const line of fitted.lines) {
      drawSpaced(ctx, line, width * element.x, y, fitted.spacing);
      y += fitted.lineHeight;
    }
  };

  drawBlock(spec.eyebrow, eyebrow, 600, 1);
  drawBlock(spec.title, title, 700, 2);
  drawBlock(spec.subtitle, subtitle, 400, 2);

  return canvas;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

// P4 用法示例：正文卡（导出 1354×600）
async function exportBodyPoster() {
  const canvas = document.createElement('canvas');
  const background = await loadImage('/assets/title-poster-bottom-677x300.png');
  drawTitlePoster({
    canvas, width: 677, height: 300, background,
    title: '文章标题', subtitle: '副标题占位', eyebrow: 'FIELD NOTES',
    theme: 'editorial', layout: 'minimal',
  });
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'title-poster-677x300@2x.png';
    link.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
```

注意事项：

- 底图必须先确认「没有任何文字」；代码不做 OCR 校验，发现文字要重绘底图。
- 底图必须同源或允许 CORS，否则 canvas 会被污染，`toBlob` 无法导出（具体部署环境未确认）。
- `fitText` 超出行数会抛错；P4 需要捕获并提示「缩短标题或增高画布」，不能静默截断。
- 1:1 使用单独的 1:1 底图，不要直接把 2.35:1 底图塞进 1:1 画布中心裁切。
- Canvas 2D 没有稳定的字间距 API；示例用逐字绘制实现字距，英文单词可能被按字符拆开，标题以中文为主时可用。

**导出后如何进入公众号**

1. 用上面的 `toBlob` 或 `canvas.toDataURL('image/png')` 得到 PNG 文件。
2. **正文标题卡**：在公众号编辑器里把 PNG 手动拖到正文顶部（首图之后、导语之前），或复制图片二进制后粘贴；编辑器会自动上传到它自己的 CDN。
3. **封面**：在封面设置里分别上传 900×383 的 2.35:1 图和 200×200 的 1:1 图，按后台预览调整裁剪。
4. **为什么不能直接放进 `<img src>`**：
   - 提交给 `submit_article` 的 HTML 里，图片只接受 `asset://<素材ID>` 或已注册的 `assets/<file>`；本地路径、base64、`https` 外链都会触发 `图片必须引用本任务已经存在的素材 ID。`
   - 公众号编辑器不认 `asset://` 或本地路径，只认它自己上传后的图片 URL。
   - 所以 PNG 是独立的手动上传步骤，不写入 `article.html`；不要写 `<img src="本地路径">` 或 `<img src="data:image/png;base64,...">`。

## 五、验收清单（人工执行，4 条）

| 检查项 | 看什么 | 期望 | 不通过怎么改 |
|---|---|---|---|
| 真机粘贴后标题是否可选中 | 路线 A：在公众号编辑器粘贴 HTML 后，用鼠标/手指选中标题文字；路线 B：确认标题是像素，不可选中是预期 | 路线 A 的「文章标题」是可选中、可编辑的文本，样式没有丢；路线 B 的标题清晰、无错字 | 路线 A 不可选中或样式丢失：简化内联样式或改用 PNG 路线；PNG 有错字：重绘底图/文字层，不能把错字留在成品里 |
| 手机端字号是否过小 | 用手机微信打开草稿或预览，在 375px 左右宽度看标题、副标题、小标签 | 标题一眼可读，副标题不小于 14px 等效视觉大小，正文不横向滚动 | 标题太小：提高字号或缩短标题；文字溢出：降字号/增高画布/改走 2.35:1；HTML 版调整字号与换行 |
| 封面裁切后标题是否被切 | 分别上传 900×383（2.35:1）和 200×200（1:1），看两种封面预览和裁剪 | 两种比例下标题都完整、可读，关键文字在安全区内 | 1:1 被切：重排 1:1 文字层或重绘 1:1 底图；2.35:1 被切：把文字移入中央安全区；不要靠拉伸图片解决 |
| 底图是否出现文字 | 把底图放大到 100%，检查汉字、字母、数字、logo、水印、二维码、签名 | 底图完全没有文字和标志，只有几何色块/细线 | 发现任何文字：整张底图重绘；不能后期涂抹、不能把错字留在成品里；中文标题始终由代码绘制 |

补充：`display: flex` 是否能通过微信编辑器、677px 是否为所有客户端正文宽度、1:1 从 2.35:1 裁切是否可用，均未确认，需按上面的真机检查执行。
