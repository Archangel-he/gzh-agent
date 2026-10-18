# 标题卡设计规范（双轨交付）

> 适用前提：文章 HTML 里的 `<img>` 只接受 `asset://<素材ID>` 或已注册的 `assets/<file>`；`https` 外链、本地路径、base64 都会被 `validateArticle` 判错。微信公众号编辑器不认本地路径，但接受手动拖入的图片文件，以及剪贴板里的图片二进制，并会自动上传到它自己的 CDN。因此标题卡采用两条互不混用的交付路径：
>
> - **路线 A**：纯 HTML 内联样式标题卡，随正文一起复制。
> - **路线 B**：canvas 绘制后导出 PNG，用户手动拖入正文顶部或设为封面。

白名单以 [wechat-constraints.md](./wechat-constraints.md) 为准。本文不涉及修改 `lib/article.mjs`。

## 一、设计规则

### 1.1 主题色

标题卡只使用文章主题已有的两个颜色：主色 `color` 与浅底 `tint`。

| 主题 id | 主色 `color` | 浅底 `tint` |
|---|---|---|
| `editorial`（墨绿刊读） | `#174c43` | `#edf3ef` |
| `warm`（暖纸叙事） | `#994d32` | `#faf0e6` |
| `blue`（蓝色简报） | `#285e9c` | `#edf3fa` |

### 1.2 方向 1：大字号极简

视觉：浅色底、超大标题、一条细线、大量留白；不铺大面积色块。

| 项目 | 规格 |
|---|---|
| 标题字号（正文卡 677px 宽） | 36–44px |
| 标题字号（封面 900px 宽） | 52–64px |
| 标题字号（1:1 200px） | 20–24px |
| 字重 | 标题 600–700；小标签 500–600 |
| 字间距 | 标题 1–2px 或 0.02–0.06em；小标签 2–4px |
| 行高 | 1.25–1.4 |
| 留白比例 | 左右内边距 8–10% 画布宽；上下 10–14% 画布高；文字区域约占 30–40%，留白 60–70% |
| 配色 | 背景 `tint`；标题与细线 `color`；副标题用 `color` 或中性深灰；浅色主题改用白/极浅底 + 深色字 |

适合：标题 8–20 字（建议不超过约 24 字）；无人像或人物图放在文字下方；深色主题（`editorial`、`warm`、`blue`）用浅底深字最稳，浅色主题优先这个方向。有人物图且需要文字压图时，走路线 B。

### 1.3 方向 2：色块 + 副标题

视觉：大面积主题色块、白色大标题、短副标题、一条浅色细线；适合需要更强视觉重心的标题卡。

| 项目 | 规格 |
|---|---|
| 标题字号（正文卡 677px 宽） | 30–38px |
| 标题字号（封面 900px 宽） | 48–56px |
| 标题字号（1:1 200px） | 18–22px |
| 副标题字号 | 15–18px（1:1 时 10–12px） |
| 字重 | 标题 700；副标题 400–500；小标签 600 |
| 字间距 | 标题 0–1px；小标签 2–3px |
| 行高 | 标题 1.3–1.45；副标题 1.6–1.8 |
| 留白比例 | 色块内边距 6–8% 画布宽；标题与副标题间距 12–18px；色块占画面高 45–65%，其余为留白 |
| 配色 | 色块 `color`；标题 `#ffffff`；副标题 `tint`；细线 `tint`。主题色很浅时反色：浅色块 + 深色字 |

适合：标题 6–14 字、副标题 12–24 字；无人像或人物图单独放在色块下方；主题色深（`editorial`、`warm`、`blue`）时白字对比最清楚；需要封面图或更强分享视觉时优先这个方向。

### 1.4 选择建议

| 情况 | 推荐 |
|---|---|
| 标题 15–24 字，无人物图 | 方向 1（大字号极简） |
| 标题 6–14 字，有副标题 | 方向 2（色块 + 副标题） |
| 有人物图，需要文字压图、裁剪或圆角 | 路线 B（canvas PNG） |
| 需要随正文一键复制 | 路线 A（纯 HTML） |
| 需要封面图 / 分享图 | 路线 B（900×383 或 200×200） |
| 主题色很浅 | 方向 1；方向 2 必须反色 |

以上字数和比例为设计建议，不是微信平台限制。

## 二、路线 A：HTML 标题卡

### 2.1 通用约束

- 只使用 [wechat-constraints.md](./wechat-constraints.md) 允许的标签和 CSS 属性；不使用 `class`、`id`、`<style>`、外部 CSS。
- 不使用 `position`、`display: grid`、`flex`、伪元素、`box-shadow`、`text-shadow`、`opacity`、`background-image`。
- `<img>` 的 `style` 会被 `validateArticle` 固定重写为 `max-width:100%;height:auto;display:block;margin:18px auto;`，因此路线 A 不能做图片圆角、裁剪、文字压图；需要这些效果走路线 B。
- 以下片段是 `submit_article` 的正文 body 片段，不要包 `<html>`/`<body>`；占位标题统一为「文章标题」。
- 片段使用 `editorial` 的 `#174c43` / `#edf3ef`；换成 `warm` 或 `blue` 时，按 1.1 表替换这两个色值。

### 2.2 方向 1：大字号极简

```html
<section style="background-color:#edf3ef;padding:56px 48px 52px;border-radius:2px;">
  <p style="margin:0 0 18px;color:#174c43;font-size:12px;font-weight:600;letter-spacing:3px;line-height:1.6;">
    <span leaf="">FIELD NOTES · 公众号排版</span>
  </p>
  <h1 style="margin:0;color:#174c43;font-size:40px;font-weight:700;letter-spacing:1px;line-height:1.3;text-align:left;">
    <span leaf="">文章标题</span>
  </h1>
  <section style="margin-top:28px;width:48px;height:1px;border-top:1px solid #174c43;"></section>
  <p style="margin:20px 0 0;color:#174c43;font-size:14px;font-weight:400;letter-spacing:0.5px;line-height:1.8;">
    <span leaf="">副标题占位 · 一句话说明文章主题</span>
  </p>
</section>
```

使用到的 CSS 属性：`background-color`、`padding`、`border-radius`、`margin`、`color`、`font-size`、`font-weight`、`letter-spacing`、`line-height`、`text-align`、`margin-top`、`width`、`height`、`border-top`，均在允许清单内。

### 2.3 方向 2：色块 + 副标题

```html
<section style="background-color:#174c43;padding:44px 44px 40px;border-radius:4px;">
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

使用到的 CSS 属性：`background-color`、`padding`、`border-radius`、`margin`、`color`、`font-size`、`font-weight`、`letter-spacing`、`line-height`、`margin-top`、`width`、`height`、`border-top`，均在允许清单内。

### 2.4 做不到的效果与允许范围内的替代

| 想要的效果 | 结论 | 允许范围内的替代 |
|---|---|---|
| 文字阴影 / 发光 | **做不到**：`text-shadow` 不在允许属性清单 | 用主色或白色 + 700 字重 + 更大字号建立层级 |
| 盒子阴影 | **做不到**：`box-shadow` 不在允许属性清单 | 用 `border` 或 `background-color` 色块分隔 |
| 整体透明度 | **做不到**：`opacity` 不在允许属性清单 | 用 `rgba(...)` 写 `color` / `background-color`（值字符集允许） |
| 绝对定位 / 文字压图 | **做不到**：`position` 会直接判错；`<img>` 的 `style` 还被固定重写 | 文字与图片上下排；需要压图、裁剪、圆角走路线 B |
| 多列 / flex / grid | `display: grid` 会判错；`display: flex` 当前未被 `validateArticle` 拦截，但微信编辑器兼容性未确认 | 用 `table` 或块级 `section` 排列 |
| 伪元素装饰 | **做不到**：内联 `style` 无法表达选择器；`<style>` 会判错 | 用真实的 `span` / `section` 元素 |
| 图片圆角 / 裁剪 / 描边 | **做不到**：`<img>` 的 `style` 会被固定重写 | 用路线 B 的 canvas 处理图片 |
| 自定义字体 / 图标字体 | `font-family` 可以写，但外部字体加载未确认 | 用系统字体栈 |
| 渐变背景 | `background-image` 不在清单；`background` 写渐变能否被公众号保留未确认 | 用纯色 `background-color` |
| 文字描边 | **做不到**：`-webkit-text-stroke` 不在允许属性清单 | 用字重与颜色对比 |

## 三、路线 B：PNG 标题海报

### 3.1 尺寸规格

| 用途 | 逻辑像素 | 2x 导出 | 比例 | 说明 |
|---|---|---|---|---|
| 正文等宽标题卡 | 677 × 260 | 1354 × 520 | 约 2.60:1 | 677px 是桌面编辑器常用正文宽度；高度可按标题长度在 220–320px 之间调整 |
| 封面 2.35:1 | 900 × 383 | 1800 × 766 | 2.35:1 | 头条封面常用规格 |
| 封面 1:1 | 200 × 200 | 400 × 400 | 1:1 | 小图 / 次条封面常用；用 2x 源图保证清晰 |

- 677px 是常用正文宽度，微信不同客户端是否缩放未确认。
- 900×383 与 200×200 是常用封面规格；后台上传后的裁剪、压缩行为未确认，以实际预览为准。
- 同一张 2.35:1 封面如果还会用于 1:1 场景，关键文字保持在画面中央约 70% 宽度内；平台实际裁剪策略未确认。
- 若后台提示需要更大源图，1:1 可用 1080×1080 导出；是否必要未确认。

### 3.2 绘制要点

**字体（只用系统字体）**

| 用途 | Windows 候选 | macOS 候选 |
|---|---|---|
| 标题 | Microsoft YaHei（微软雅黑）Bold、Segoe UI Semibold、Arial Bold | PingFang SC（苹方）Semibold、Hiragino Sans GB（冬青黑体）W6、Helvetica Neue Bold |
| 副标题 / 小字 | Microsoft YaHei、Segoe UI、Arial | PingFang SC、Hiragino Sans GB、Helvetica Neue |

Canvas 字体栈：

```js
const FONT_STACK = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB","Segoe UI",sans-serif';
```

具体字重是否安装取决于设备，实际渲染未确认；不要依赖未安装的字体。

**字号与画布换算比例**

| 画布 | 标题 | 副标题 | 小标签 |
|---|---|---|---|
| 677 × 260 | 38–44px（画布宽的 5.6–6.5%） | 16–18px（2.4–2.7%） | 11–12px（1.6–1.8%） |
| 900 × 383 | 52–64px（5.8–7.1%） | 20–24px（2.2–2.7%） | 13–15px（1.4–1.7%） |
| 200 × 200 | 20–24px（10–12%） | 10–12px（5–6%） | 9–10px（4.5–5%） |

先按比例算字号，再用 `measureText` 检查行数；标题超过 2 行时，降低字号或增加画布高度。方形画布需要相对更大的字号。

**文字安全边界**

- 左右内边距：画布宽的 8–10%。
- 上下内边距：画布高的 10–14%。
- 677×260：左右约 54–68px，上下约 26–36px。
- 900×383：左右约 72–90px，上下约 38–54px。
- 200×200：左右约 16–20px，上下约 20–28px。
- 标题、副标题、细线都不要贴边；底部细线要放在文字下方的安全区内。

**色块与留白**

- 方向 1：文字占画面约 30–40%，留白 60–70%；最多一条细线。
- 方向 2：色块占画面高约 45–65%，文字在色块内；其余留白 35–55%；色块内边距为画布宽的 6–8%。
- 使用纯色；渐变、阴影、整体透明度在 PNG 中可以做，但为了和路线 A 的视觉一致，默认不用。

### 3.3 Canvas 代码示例

> 这是给前端实现的参考代码，不是要现在修改 `public/`。示例使用 2x 内部分辨率，导出 PNG 的实际像素是逻辑尺寸的两倍。

```html
<!-- 参考实现：前端可用；本文档不修改 public/ -->
<canvas id="title-card" style="display:none"></canvas>
<script>
const THEMES = {
  editorial: { color: '#174c43', tint: '#edf3ef' },
  warm: { color: '#994d32', tint: '#faf0e6' },
  blue: { color: '#285e9c', tint: '#edf3fa' },
};
const FONT_STACK = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB","Segoe UI",sans-serif';

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const ch of Array.from(text)) {
    const next = line + ch;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = ch;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawTitleCard({
  canvas, width, height, title, subtitle = '', eyebrow = '',
  theme = 'editorial', layout = 'block', scale = 2,
}) {
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.textBaseline = 'top';

  const t = THEMES[theme] || THEMES.editorial;
  const padX = Math.round(width * 0.08);
  const padY = Math.round(height * 0.12);
  const textWidth = width - padX * 2;
  const square = width <= 240;
  const titleSize = Math.round(width * (square ? 0.11 : 0.06));
  const subSize = Math.round(width * (square ? 0.055 : 0.025));
  const eyebrowSize = Math.round(width * (square ? 0.045 : 0.018));

  ctx.fillStyle = layout === 'block' ? t.color : t.tint;
  ctx.fillRect(0, 0, width, height);

  const titleColor = layout === 'block' ? '#ffffff' : t.color;
  const subColor = layout === 'block' ? t.tint : t.color;
  let y = padY;

  if (eyebrow) {
    ctx.fillStyle = subColor;
    ctx.font = `600 ${eyebrowSize}px ${FONT_STACK}`;
    ctx.fillText(eyebrow, padX, y);
    y += eyebrowSize * 2;
  }

  ctx.fillStyle = titleColor;
  ctx.font = `700 ${titleSize}px ${FONT_STACK}`;
  for (const line of wrapText(ctx, title, textWidth)) {
    ctx.fillText(line, padX, y);
    y += titleSize * 1.35;
  }

  if (subtitle) {
    y += subSize * 0.8;
    ctx.fillStyle = subColor;
    ctx.font = `400 ${subSize}px ${FONT_STACK}`;
    for (const line of wrapText(ctx, subtitle, textWidth)) {
      ctx.fillText(line, padX, y);
      y += subSize * 1.6;
    }
  }

  ctx.fillStyle = subColor;
  ctx.fillRect(padX, height - padY, Math.min(64, width * 0.12), 1);
  return canvas;
}

function downloadPng(canvas, filename) {
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

// 用法：正文卡（导出 1354×520）
const canvas = document.getElementById('title-card');
drawTitleCard({
  canvas, width: 677, height: 260,
  title: '文章标题', subtitle: '副标题占位', eyebrow: 'FIELD NOTES',
  theme: 'editorial', layout: 'minimal',
});
downloadPng(canvas, 'title-card-677x260@2x.png');
</script>
```

注意事项：

- 示例不做自动缩放或截断；标题过长时先降字号或增高画布。
- Canvas 2D 没有稳定的字间距 API；`ctx.letterSpacing` 的浏览器支持不一致，示例未使用。需要字间距时逐字绘制，具体效果未确认。
- 导出前确认 `canvas.toBlob` 返回非空；页面没有跨域图片时不会被 taint。

### 3.4 导出 PNG 后如何进入公众号

1. 用 `downloadPng`（或 `canvas.toDataURL('image/png')`）导出 PNG 文件。
2. **正文标题卡**：在微信公众号编辑器中，把 PNG 手动拖到正文顶部；或复制图片二进制后粘贴。编辑器会自动上传到它自己的 CDN。路线 B 的 PNG 不写入 `article.html`。
3. **封面图**：在封面设置里上传 900×383 的 2.35:1 图，或 200×200 的 1:1 图；按后台预览调整裁剪。
4. **为什么不能直接放进 `<img src>`**：
   - 提交给 `submit_article` 的 HTML 里，`<img src>` 只接受 `asset://<素材ID>` 或已注册的 `assets/<file>`；本地路径、base64、`https` 外链都会触发 `图片必须引用本任务已经存在的素材 ID。`
   - 微信公众号编辑器不认 `asset://` 或本地路径；它需要自己上传后生成的图片 URL。
   - 因此路线 B 的 PNG 是独立的手动上传步骤，不参与文章 HTML 的图片校验；不要把它写成 `<img src="本地路径">` 或 `<img src="data:image/png;base64,...">`。

## 四、验收方式

| 检查项 | 看什么 | 期望 |
|---|---|---|
| 真机粘贴：路线 A | 在微信公众号编辑器粘贴 HTML 标题卡，检查背景色、字号、字重、字间距、行高、留白和换行 | 标题卡结构完整、无横向滚动、标题「文章标题」不被截断；内联样式是否全部保留需以实际编辑器为准（未确认） |
| 真机粘贴：路线 B | 把 2x PNG 拖入正文顶部，检查是否自动上传、清晰度、宽度与白边 | 图片上传成功、宽度与正文一致、文字清晰无模糊、无异常白边；如未自动上传则失败 |
| 封面显示 | 分别上传 900×383（2.35:1）和 200×200（1:1），查看两种封面预览和裁剪 | 关键标题不被裁掉、文字可读、色块完整；平台实际裁剪策略未确认，以后台预览为准 |
| 手机端查看 | 用手机微信打开草稿或预览，检查 375px 左右宽度下的字号、行距、留白、对比度和换行 | 标题卡完整显示、无横向滚动、文字不溢出、图片不变形；`display:flex` 是否通过微信编辑器需人工实测（未确认） |
