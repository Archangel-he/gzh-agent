# 校园抒情主题（campus-literary）

> Bloop 使用约定：以主入口和 theme-index 的预算、事实与可读性规则为准。下列组件是可选配方，不需要全部使用；8–9px 英文装饰字默认省略，需要图注时使用可读的约13px角色。章节数字仅用于真实顺序，不为装饰虚构英文、日期或二维码。图片可保留安全的圆角、尺寸、间距、边框和显示裁切样式；定位叠字仍受限制，微信兼容性需实际检查。

## 设计定位

适合校园、纪实、抒情长文；不适合学术干货、产品发布和强信息密度公告。

## 主题参数

```yaml
palette:
  ink: "#1f2a1f"
  inkSoft: "#507838"
  primary: "#58a06f"
  primarySoft: "#d0e0b8"
  paper: "#f0f0e8"
  accent: "#b01820"

typography:
  topEnglish:
    size: 8px
    weight: 400
    lineHeight: 1.6
    letterSpacing: 1.5px
    color: "#507838"
  title:
    size: 20px
    weight: 700
    lineHeight: 1.4
    letterSpacing: 0.5px
    color: "#1f2a1f"
  subtitleEn:
    size: 9px
    weight: 400
    lineHeight: 1.8
    letterSpacing: 2.5px
    color: "#507838"
  chapterNumber:
    size: 28px
    weight: 800
    lineHeight: 1.1
    letterSpacing: 0px
    color: "#1f2a1f"
  chapterLabel:
    size: 9px
    weight: 700
    lineHeight: 1.6
    letterSpacing: 1px
    color: "#58a06f"
  sectionTitle:
    size: 18px
    weight: 700
    lineHeight: 1.4
    letterSpacing: 0.5px
    color: "#1f2a1f"
  body:
    size: 15px
    weight: 400
    lineHeight: 1.8
    letterSpacing: 0.5px
    color: "#1f2a1f"
  emphasis:
    size: 15px
    weight: 700
    lineHeight: 1.8
    letterSpacing: 0.5px
    color: "#1f2a1f"
  date:
    size: 9px
    weight: 500
    lineHeight: 1.4
    letterSpacing: 1px
    color: "#507838"
  quote:
    size: 15px
    weight: 400
    lineHeight: 1.8
    letterSpacing: 0.5px
    color: "#1f2a1f"
  credits:
    size: 12px
    weight: 400
    lineHeight: 1.8
    letterSpacing: 0.5px
    color: "#507838"

spacing:
  paragraphGap: 27px
  sectionGap: 72px
  pagePaddingPercent: 15

density:
  maxLinesPerScreen: 15
```

## 来源与未确认

- 本主题从第一篇的绿色纸感版式抽取；第二篇的蓝色水彩、第三篇的星空油画是变体，不写进本主题。
- **封面主标题：未确认。** 截图里的封面大标题在图片素材内，精确字号和字体无法从 DOM 读取；本主题只定义 HTML 标题卡 `title: 20px`，不把封面的 28–40px 目测值写成 token。
- **A2/A3 的部分章节标签/正文是否为图片文字：未确认。** 本主题只复现可确认为 HTML 的文字结构。
- **字体族：未确认。** 组件不指定 `font-family`、不加载外部字体；默认沿用正文系统字体。
- **A1 的绿色衬底/细线是 CSS 还是图片：未确认。** 本主题用 `background-color` 和 `border` 做近似，不声称逐像素还原。
- **微信编辑器的最终渲染：未确认。** 字距、圆角、边框、背景色在公众号后台的真实表现需要真机验证。
- 红色 QR 尾图、树叶/手写贴纸、纸张/水彩/星空纹理都是图片资产，不能用本主题的 CSS 复现，未放进组件。

## 组件库（8 个）

### 1. 顶部多行英文小字

**使用条件**：文章最顶部，建立栏目/期号/日期语境；每篇最多 1 次。

```html
<section style="padding:0 0 24px;border-bottom:1px solid #58a06f;">
  <p style="margin:0;color:#507838;font-size:8px;font-weight:400;line-height:1.6;letter-spacing:1.5px;">
    <span leaf="">CAMPUS LITERARY</span>
  </p>
  <p style="margin:0;color:#507838;font-size:8px;font-weight:400;line-height:1.6;letter-spacing:1.5px;">
    <span leaf="">FIELD NOTES</span>
  </p>
  <p style="margin:0;color:#507838;font-size:8px;font-weight:400;line-height:1.6;letter-spacing:1.5px;">
    <span leaf="">VOL. 01</span>
  </p>
  <p style="margin:0;color:#507838;font-size:8px;font-weight:400;line-height:1.6;letter-spacing:1.5px;">
    <span leaf="">2026 / 1 / 1</span>
  </p>
</section>
```

CSS 属性：`padding`、`border-bottom`、`margin`、`color`、`font-size`、`font-weight`、`line-height`、`letter-spacing`。

### 2. 中英对照主标题

**使用条件**：正文开头的 HTML 标题卡，不代替公众号封面；每篇最多 1 次。

```html
<section style="padding:32px 0 28px;border-top:1px solid #1f2a1f;border-bottom:1px solid #1f2a1f;">
  <p style="margin:0;color:#507838;font-size:9px;font-weight:400;line-height:1.8;letter-spacing:2.5px;text-align:center;">
    <span leaf="">A CAMPUS STORY</span>
  </p>
  <h1 style="margin:10px 0 0;color:#1f2a1f;font-size:20px;font-weight:700;line-height:1.4;letter-spacing:0.5px;text-align:center;">
    <span leaf="">标题</span>
  </h1>
  <p style="margin:8px 0 0;color:#507838;font-size:8px;font-weight:400;line-height:1.6;letter-spacing:1.5px;text-align:center;">
    <span leaf="">TITLE IN ENGLISH</span>
  </p>
</section>
```

CSS 属性：`padding`、`border-top`、`border-bottom`、`margin`、`color`、`font-size`、`font-weight`、`line-height`、`letter-spacing`、`text-align`。

### 3. 带斜杠章号

**使用条件**：每个章节开头；每章 1 次，全文 2–5 次。斜杠是文本，不是伪元素。

```html
<section style="margin:56px 0 24px;padding-top:12px;border-top:1px solid #1f2a1f;">
  <p style="margin:0;line-height:1.1;">
    <span style="color:#1f2a1f;font-size:28px;font-weight:800;letter-spacing:0px;">01</span>
    <span style="color:#58a06f;font-size:9px;font-weight:700;letter-spacing:1px;vertical-align:middle;"> / 校园 / 纪实 / 特稿 /</span>
  </p>
</section>
```

CSS 属性：`margin`、`padding-top`、`border-top`、`line-height`、`color`、`font-size`、`font-weight`、`letter-spacing`、`vertical-align`。

### 4. 英文章节小标

**使用条件**：章号之后、正文之前；每章最多 1 次。

```html
<section style="margin:24px 0 8px;">
  <p style="margin:0;color:#507838;font-size:9px;font-weight:700;line-height:1.6;letter-spacing:2px;">
    <span leaf="">A CAMPUS STORY</span>
  </p>
</section>
```

CSS 属性：`margin`、`color`、`font-size`、`font-weight`、`line-height`、`letter-spacing`。

### 5. 日期行

**使用条件**：章节正文之后或章末；每章最多 1 次。

```html
<section style="margin:24px 0 0;">
  <section style="width:32px;height:1px;margin-left:auto;margin-bottom:8px;border-top:1px solid #1f2a1f;"></section>
  <p style="margin:0;color:#507838;font-size:9px;font-weight:500;line-height:1.4;letter-spacing:1px;text-align:right;">
    <span leaf="">2026 / 1 / 1</span>
  </p>
</section>
```

CSS 属性：`margin`、`width`、`height`、`margin-left`、`margin-bottom`、`border-top`、`color`、`font-size`、`font-weight`、`line-height`、`letter-spacing`、`text-align`。

### 6. 关键词强调

**使用条件**：正文中的关键词或关键句；按需使用，同一段最多 2 处。

```html
<p style="margin:0 0 27px;color:#1f2a1f;font-size:15px;font-weight:400;line-height:1.8;letter-spacing:0.5px;">
  <span leaf="">正文正文正文</span><strong style="color:#1f2a1f;font-size:15px;font-weight:700;letter-spacing:0.5px;">关键词</strong><span leaf="">正文正文正文。</span>
</p>
```

CSS 属性：`margin`、`color`、`font-size`、`font-weight`、`line-height`、`letter-spacing`。

### 7. 引语块

**使用条件**：一章的开头或结尾，用来放人物原话、题记或关键句；每篇最多 2 次。

```html
<section style="margin:32px 0;padding:20px 24px;background-color:#d0e0b8;border-left:3px solid #58a06f;border-radius:2px;">
  <p style="margin:0;color:#1f2a1f;font-size:15px;font-weight:400;line-height:1.8;letter-spacing:0.5px;text-align:left;">
    <span leaf="">正文</span>
  </p>
  <p style="margin:8px 0 0;color:#507838;font-size:9px;font-weight:500;line-height:1.4;letter-spacing:1px;text-align:left;">
    <span leaf="">2026 / 1 / 1</span>
  </p>
</section>
```

CSS 属性：`margin`、`padding`、`background-color`、`border-left`、`border-radius`、`color`、`font-size`、`font-weight`、`line-height`、`letter-spacing`、`text-align`。

### 8. 结尾落款

**使用条件**：文章最后，交代文案、图片、排版、审核；每篇最多 1 次。

```html
<section style="margin:56px 0 0;padding-top:20px;border-top:1px solid #58a06f;text-align:right;">
  <p style="margin:0;color:#507838;font-size:12px;font-weight:400;line-height:1.8;letter-spacing:0.5px;">
    <span leaf="">文案 | 标题</span>
  </p>
  <p style="margin:0;color:#507838;font-size:12px;font-weight:400;line-height:1.8;letter-spacing:0.5px;">
    <span leaf="">图片 | 标题</span>
  </p>
  <p style="margin:0;color:#507838;font-size:12px;font-weight:400;line-height:1.8;letter-spacing:0.5px;">
    <span leaf="">排版 | 标题</span>
  </p>
  <p style="margin:0;color:#507838;font-size:12px;font-weight:400;line-height:1.8;letter-spacing:0.5px;">
    <span leaf="">审核 | 标题</span>
  </p>
</section>
```

CSS 属性：`margin`、`padding-top`、`border-top`、`text-align`、`color`、`font-size`、`font-weight`、`line-height`、`letter-spacing`。

## 使用配方

### 纪实长文（3000 字以上）

1. 顶部多行英文小字 ×1
2. 中英对照主标题 ×1
3. 引语块 ×1（可选，放开篇题记）
4. 正文段落，使用 `typography.body`；关键词处插入关键词强调
5. 按 2–5 章重复：带斜杠章号 ×1 → 英文章节小标 ×1 → 正文段落 → 日期行 ×1 → 引语块（可选）
6. 结尾落款 ×1

### 短篇招募（800 字以内）

1. 顶部多行英文小字 ×1
2. 中英对照主标题 ×1
3. 引语块 ×1（可选）
4. 1–2 段正文，关键词处插入关键词强调
5. 带斜杠章号 ×1 → 英文章节小标 ×1（只做一个章节）
6. 日期行 ×1
7. 结尾落款 ×1

## 硬约束对照

- 使用标签：`section`、`p`、`h1`、`strong`、`span`，均在 `allowedTags` 内；`span` 只额外使用 `leaf` 属性。
- 使用 CSS 属性：`margin`、`margin-left`、`margin-bottom`、`padding`、`padding-top`、`border-top`、`border-bottom`、`border-left`、`border-radius`、`background-color`、`color`、`font-size`、`font-weight`、`line-height`、`letter-spacing`、`text-align`、`width`、`height`、`vertical-align`，均在 `allowedStyles` 内。
- 未使用：`class`、`id`、`<style>`、`<link>`、`<script>`、伪元素、`background-image`、`position`、`grid`、flex、`opacity`、`box-shadow`、`text-shadow`、`!important`。
- 所有颜色为 `#rrggbb`；所有字号为具体 px；所有样式都是内联 `style`。

### 做不到的效果与替代

| 想要的效果 | 结论 | 允许范围内的替代 |
|---|---|---|
| 纸张/水彩/星空/照片作为文字背景 | **做不到**：`background-image` 不在白名单；`<img>` 的安全内联样式会保留且没有定位 | 用 `background-color` 的纸色/浅色块；照片单独作为 `<img src="asset://...">` 放在文字之间，不做文字压图 |
| 半透明叠层、网点纹理、纸张肌理 | **做不到**：`opacity` 不在白名单；纹理需要图片 | 用纯色 `primarySoft` / `paper` 和 `border` 做近似 |
| 顶部红色线稿/印章、树叶/手写贴纸、红色 QR 尾图 | **做不到**：这些是图片资产，不能由 CSS 绘制 | 作为独立图片素材插入；不要声称能用 CSS 复现 |
| 伪元素装饰线、装饰角 | **做不到**：不允许伪元素 | 用真实的 `section`/`hr` 和 `border` |
| 多栏、左右分栏、绝对定位 | **做不到**：`position` 会判错，grid 会判错，flex 兼容性未确认 | 用块级 `section`、`table` 或上下排列 |
| 文字阴影/发光、描边字 | **做不到**：`text-shadow` 等不在白名单 | 用字号、字重、颜色对比 |
| 动画 GIF、外部字体、外部 CSS/JS | **做不到/未确认**：图片链路会转 PNG，外部字体加载未确认，外部资源不允许 | 用静态 PNG 图片和系统字体 |

## 不要做的事

1. 不要自动给用户文章加断行或改段落，那是改内容。
2. 不要用 `<style>`、class、伪元素、`background-image` 或外部 CSS/JS 去复现截图里的图片化效果，做不到就写「做不到」并用纯色块/边框/独立 `<img>` 替代。
3. 不要声称已经还原截图或已经通过微信编辑器，本主题的颜色和字号是目测 token，发布前需要真机实测。
