# 微信公众号 HTML 排版约束

> 本文随分支引入，历史行号可能过时。以主 skill、实际工具错误和当前白名单为准。桌面与提交工具素材上限为6张；不要以 Web 原型的8张预检作为可提交保证。

> 用途：排版前必读；本文档是 `lib/article.mjs` 中 `validateArticle` 的静态白名单摘录，提交的正文 HTML 违反任一条即无法通过 `submit_article`，发布失败。

来源：`lib/article.mjs:11-13`（标签、style 属性、值正则）与 `validateArticle`（第 18-49 行）。除标注“未确认”外，以下均为代码直接事实。

## 1. 允许的标签

公共规则：除表中特别说明外，每个标签只允许 `style` 一个属性；`class`、`id`、`data-*` 等属性不在 `allowedAttributes` 中，会被 sanitize-html 丢弃（不报错）。

| 标签 | 常见用途 | 注意事项 |
|---|---|---|
| `section` | 文章分节、外层容器 | 仅 `style` |
| `p` | 段落 | 仅 `style` |
| `span` | 行内文字、公众号 `leaf` 包裹 | 额外允许 `leaf` 属性 |
| `strong` | 加粗 | 仅 `style` |
| `em` | 斜体 | 仅 `style` |
| `u` | 下划线 | 仅 `style` |
| `s` | 删除线 | 仅 `style` |
| `br` | 换行 | 仅 `style` |
| `img` | 正文配图 | 只保留 `src`、`alt`、`style`；`src` 必须是本任务已注册素材；保留白名单内的自定义样式，默认 max-width:100%、height:auto、display:block、margin:18px auto，自定义声明优先 |
| `blockquote` | 引用块 | 仅 `style` |
| `ul` | 无序列表 | 仅 `style` |
| `ol` | 有序列表 | 仅 `style` |
| `li` | 列表项 | 仅 `style` |
| `table` | 表格 | 仅 `style` |
| `thead` | 表头组 | 仅 `style` |
| `tbody` | 表体组 | 仅 `style` |
| `tr` | 表格行 | 仅 `style` |
| `th` | 表头单元格 | 额外允许 `colspan`、`rowspan` |
| `td` | 数据单元格 | 额外允许 `colspan`、`rowspan` |
| `a` | 链接 | 只保留 `href`、`style`；`href` 仅允许 `http`/`https`，不允许 `//` 协议相对地址 |
| `h1` | 一级标题 | 仅 `style` |
| `h2` | 二级标题 | 仅 `style` |
| `h3` | 三级标题 | 仅 `style` |
| `h4` | 四级标题 | 仅 `style`；`h5`、`h6` 不在白名单 |
| `pre` | 预格式化文本 | 仅 `style` |
| `code` | 行内代码 | 仅 `style` |
| `hr` | 分隔线 | 仅 `style` |

## 2. 允许的样式属性

公共规则：值必须匹配 `/^[#\w\s.,()%/+'"\-\u3400-\u9fff]+$/`（`lib/article.mjs:13`）。值中出现字符集外的字符（例如 `!`、`@`、`;`、`[`、`]`、`{`、`}`）时，该条声明不会通过 `allowedStyles`，会被 sanitize-html 丢弃；`!important` 因含 `!` 属于会被吞的写法。单位本身（`px`、`%`、`em`、`rem`、`vh`、`vw`、`pt`）都在字符集内，不会被这条正则拦下；它们在公众号里的最终渲染未在本仓库验证（未确认）。

| 属性 | 常用取值 | 注意（哪些单位/写法会被吞） |
|---|---|---|
| `color` | `#174c43`、`rgb(23,76,67)`、`rgba(23,76,67,.8)`、`red` | `!important` 被吞；函数式颜色字符集允许，渲染未确认 |
| `background` | `#fff`、`rgba(...)`、`none`、`linear-gradient(...)` | `!important` 被吞；`url(...)` 是否保留未确认 |
| `background-color` | `#fff`、`rgba(...)` | `!important` 被吞；渲染未确认 |
| `font-family` | `-apple-system`、`"PingFang SC"`、`sans-serif` | 引号、逗号、连字符允许；外部字体加载未验证（未确认） |
| `font-size` | `16px`、`1rem`、`100%` | 单位字符集允许；渲染未确认 |
| `font-weight` | `400`、`700`、`bold` | 数字/关键字允许；渲染未确认 |
| `font-style` | `normal`、`italic` | 关键字允许；渲染未确认 |
| `line-height` | `1.8`、`28px`、`180%` | 无单位数字、单位均允许；渲染未确认 |
| `letter-spacing` | `0.5px`、`1px` | 小数、单位允许；渲染未确认 |
| `text-align` | `left`、`center`、`right`、`justify` | 关键字允许；渲染未确认 |
| `text-decoration` | `none`、`underline`、`line-through` | 关键字允许；渲染未确认 |
| `text-indent` | `2em`、`32px` | 单位允许；渲染未确认 |
| `white-space` | `normal`、`pre-wrap`、`nowrap` | 关键字允许；渲染未确认 |
| `word-break` | `normal`、`break-all`、`keep-all` | 关键字允许；渲染未确认 |
| `overflow-wrap` | `normal`、`anywhere`、`break-word` | 关键字允许；渲染未确认 |
| `margin` | `0 auto`、`18px 0` | `auto`、负数、`calc()` 字符集允许；渲染未确认 |
| `margin-top` | `0`、`18px`、`auto` | 单位、`auto` 允许；渲染未确认 |
| `margin-right` | `0`、`18px`、`auto` | 单位、`auto` 允许；渲染未确认 |
| `margin-bottom` | `0`、`18px`、`auto` | 单位、`auto` 允许；渲染未确认 |
| `margin-left` | `0`、`18px`、`auto` | 单位、`auto` 允许；渲染未确认 |
| `padding` | `0`、`16px 20px` | 单位、负数、`calc()` 字符集允许；渲染未确认 |
| `padding-top` | `0`、`16px` | 单位允许；渲染未确认 |
| `padding-right` | `0`、`16px` | 单位允许；渲染未确认 |
| `padding-bottom` | `0`、`16px` | 单位允许；渲染未确认 |
| `padding-left` | `0`、`16px` | 单位允许；渲染未确认 |
| `border` | `1px solid #ddd` | 颜色、单位允许；渲染未确认 |
| `border-top` | `1px solid #ddd` | 颜色、单位允许；渲染未确认 |
| `border-right` | `1px solid #ddd` | 颜色、单位允许；渲染未确认 |
| `border-bottom` | `1px solid #ddd` | 颜色、单位允许；渲染未确认 |
| `border-left` | `1px solid #ddd` | 颜色、单位允许；渲染未确认 |
| `border-color` | `#ddd`、`rgba(...)` | 颜色函数允许；渲染未确认 |
| `border-radius` | `6px`、`50%` | 单位、百分比、斜杠写法字符集允许；渲染未确认 |
| `border-collapse` | `collapse`、`separate` | 关键字允许；渲染未确认 |
| `width` | `100%`、`720px`、`auto`、`calc(...)` | `auto`、百分比、单位、`calc()` 字符集允许；渲染未确认 |
| `max-width` | `100%`、`720px`、`calc(...)` | 百分比、单位、`calc()` 字符集允许；渲染未确认 |
| `height` | `auto`、`1px`、`100%` | `auto`、百分比、单位允许；渲染未确认 |
| `vertical-align` | `top`、`middle`、`bottom` | 关键字允许；渲染未确认 |
| `display` | `block`、`inline-block`、`none` | `display: grid` 会被 raw 检查直接判错；`display: flex` 当前未被 `validateArticle` 拦截（是否允许未确认）；其余值字符集允许，渲染未确认 |

新增允许样式：object-fit、object-position、overflow、box-shadow、opacity、aspect-ratio。仍使用相同的安全值字符集检查；这些样式能保存在 Bloop 的 HTML 中，不代表微信编辑器一定保留，需后台与手机预览。

## 3. 明确禁止

代码里没有单独的“禁止列表”；是否失败由 `validateArticle` 的 raw 正则、sanitize 白名单和后续检查共同决定。以下按实际行为分组，避免把未拦截的项误写成已禁止。清单中的标签和属性都不在上面的白名单里。

### 3.1 会直接判错（有错误文案）

| 写法 | 实际判定 | 替代做法 |
|---|---|---|
| `display: grid` | `使用了不适合公众号正文的定位、grid、变量或动态样式。` | 用 `table` 或块级 `section` 排布 |
| `position: ...`（任何值） | 同上 | 用 `margin`/`padding` 控制位置，不脱离文档流 |
| `var(--x)` | 同上 | 写具体颜色/尺寸字面值 |
| `@import` | 同上 | 把样式内联到标签的 `style` |
| `<style>...</style>` 块 | `文章正文不能包含脚本、iframe、外部样式或 style 标签。` | 把规则写进各标签的 `style` |
| `<link ...>` 外部 CSS | 同上 | 同上 |
| `<script>`、`<iframe>`、`<object>`、`<embed>` | 同上 | 正文不包含这些标签 |
| `onclick=` 等 `on*=` 事件属性 | `文章中包含事件处理属性。` | 删除事件属性 |
| `expression(...)` | `使用了不适合公众号正文的定位、grid、变量或动态样式。` | 不使用 |
| `<img src="https://...">`、其他相对路径、`data:image/...;base64,...` | `图片必须引用本任务已经存在的素材 ID。` | 先作为任务素材上传/下载，正文写 `asset://<素材ID>` |
| `{{占位}}`、`插入图片`、`待补素材`、`图片URL` | `文章中仍有未填写的占位内容。` | 填入真实内容或删除占位 |
| 原文段落缺失 | `原文有 N 段内容未完整保留，请保持原文实质内容并修复。` | 保留原文每一段实质内容 |
| 素材清单中 `role` 为 `article` 的图片未在清洗后的 HTML 里出现 `assets/<file>` | `请保留所有指定为文章配图的素材。` | 每个 `role: "article"` 的素材至少在正文出现一次 |

### 3.2 会被静默移除或无法表达（不报错）

| 写法 | 代码行为 | 替代做法 |
|---|---|---|
| `class="..."` | `allowedAttributes` 只允许 `style`（及 img/a/span/td/th 的少数专用属性），`class` 被丢弃 | 把样式内联到每个标签 |
| `id="..."` | 同上 | 同上 |
| `data-*` | 同上 | 同上 |
| `!important` | `!` 不在 `allowedStyles` 字符集，该条声明被丢弃 | 不写 `!important` |
| 伪元素 `::before`/`::after`、`:hover` | 内联 `style` 无法表达选择器；`<style>` 块会直接判错 | 用真实 `span`/`section` 元素做装饰 |
| `div` | 不在 `allowedTags`；由 sanitize-html 处理，标签会被移除（保留文本的确切输出未在本项目逐项确认） | 用 `section` |
| `figure`/`figcaption` | 不在 `allowedTags`（同上） | 用 `section` + `p`/`span` |
| `h5`/`h6` | 不在 `allowedTags` | 用 `h4`，或 `strong` + `font-size` |
| `small` | 不在 `allowedTags` | 用 `span` + `font-size` |
| `mark` | 不在 `allowedTags` | 用 `span` + `background-color`/`color` |
| `dl`/`dt`/`dd` | 不在 `allowedTags` | 用 `p` + `strong` |
| `colgroup`/`col`/`caption` | 不在 `allowedTags` | 用 `td`/`th` 的 `style`，或用 `p` |
| `svg`/`canvas`/`video`/`audio`/`picture`/`source` | 不在 `allowedTags` | 用 `img` + 任务素材 |
| `button`/`form`/`input` | 不在 `allowedTags` | 正文不承载交互控件 |

### 3.3 代码未拦截（不要当成已禁止）

| 写法 | 代码行为 | 替代做法 |
|---|---|---|
| `display: flex` | `display` 在允许属性里，raw 检查只匹配 `display: grid`；因此 `display:flex` 目前能通过 `validateArticle`。是否应禁用 **未确认** | 若团队要求不用 flex：用 `table` 或块级 `section` |
| `background: url(...)` | 不在 raw 禁止正则里，值字符集也允许；sanitize-html 是否保留、公众号是否显示 **未确认** | 正文图片统一用 `asset://<素材ID>` |
| `calc(...)`、`linear-gradient(...)` | 字符集允许、未被拦截；实际渲染 **未确认** | 不确定时改用固定数值 |
| 外部字体（`font-family` 指向外部字体） | `validateArticle` 不检查字体来源；公众号是否可用 **未确认** | 使用系统字体栈 |

## 4. 已知上限

| 项目 | 上限 | 代码依据 |
|---|---|---|
| 正文 | 16,000 | `server.mjs:109`、`desktop-plugin.mjs:108`；前端 `index.html` 的 `maxlength="16000"`。按 JS `String.length`（UTF-16 码元）计算，不是严格汉字数 |
| 设计要求 | 3,000 | `server.mjs:109`、`desktop-plugin.mjs:108` |
| 首版输入图片 | 6 | `server.mjs:113`、`desktop-plugin.mjs:113` |
| 工具层素材总数 | 6 | `harness-plugin.mjs:81`（生图前要求 `< 6`）、`harness-plugin.mjs:125`（更新后 `<= 6`） |
| Web 新版本累计素材 | 8 | `server.mjs:125`；与工具层 6 张上限不一致。累计 7–8 张时，`update_article_assets` 会被 `harness-plugin.mjs:125` 拒绝 |
| 单张图片 | 5 MB | `lib/storage.mjs:64`、`lib/image-download.mjs:12` |
| 生图返回 | base64 ≤ 7,000,000 字符 | `harness-plugin.mjs:96` |
| 生图尺寸 | 1024 × 1024 | `harness-plugin.mjs:89` |
| 下载候选 | 12 | `desktop-plugin.mjs:53`、`lib/image-download.mjs:59` |

## 5. 图片引用的两个阶段

| 阶段 | 操作 | 图片要求 | 代码现状 |
|---|---|---|---|
| 阶段一：提交 HTML | 调用 `submit_article`，HTML 交给 `validateArticle` | `<img src>` 必须是 `asset://<素材ID>`，或已注册的 `assets/<file>`；`validateArticle` 会把两者统一改写成 `assets/<file>`。`https://...`、其他相对路径、`data:image/...;base64,...` 都会触发 `图片必须引用本任务已经存在的素材 ID。` | 已实现并强制 |
| 阶段二：粘贴到公众号后台 | 把正文复制/粘贴到微信公众号编辑器 | 公众号要求图片是它自己域名下的 URL；`asset://` 和本地路径都不行 | 代码目前没有处理：没有上传微信素材的步骤，也没有把图片地址替换成公众号 URL 的步骤。**未确认/待解决** |

补充事实：

- `article.html`、`preview.html` 与导出文件里的 base64 是程序保存时自动嵌入的，不属于模型提交阶段允许的图片格式。后续编辑由工具恢复为素材ID，避免把图片编码读入上下文。
- README 只说明本地图片路径不会自动变成微信素材地址、需要在公众号后台上传配图并做手机预览；没有描述阶段二的自动实现。
- 阶段二的具体平台行为、可接受的 URL 形式，以及 `asset://` 图片粘贴后的结果，仓库内没有验证，按 **未确认/待解决** 处理。

## 6. 校验命令

仓库没有独立的 `validate` CLI；现有确切命令：

```sh
npm test
node --test tests/article.test.mjs
```

`submit_article` 在运行时自动调用 `validateArticle`。要复跑某个任务目录的实际产物，从项目根目录执行（把 `<任务ID>` 换成 `data/projects/` 下的目录名）：

```sh
node --input-type=module -e "import { readFile } from 'node:fs/promises'; import path from 'node:path'; import { validateArticle } from './lib/article.mjs'; const dir = 'data/projects/<任务ID>'; const job = JSON.parse(await readFile(path.join(dir, 'job.json'), 'utf8')); const html = await readFile(path.join(dir, 'article.html'), 'utf8'); const result = validateArticle(html, { assets: job.assets, source: job.text }); console.log(JSON.stringify({ errors: result.errors, warnings: result.warnings }, null, 2));"
```

说明：上面第二条不是仓库自带脚本，而是直接调用导出函数；`validateArticle` 的 `errors` 为空只代表 HTML 检查通过，标题长度等仍由 `submit_article` 单独检查。

## 待验证清单

- [ ] 复制粘贴到公众号后，`asset://` 图片是否全部失效 —— 需人工实测
- [ ] `display: flex` 是否能通过微信编辑器 —— 需人工实测
