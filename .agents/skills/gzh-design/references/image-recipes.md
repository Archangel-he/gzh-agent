# 图片加工配方（image-recipes）

> 用途：把用户上传的照片加工成标题海报底图、正文配图、公众号封面、文章首图。加工方式是调用生图模型接口，不是本地修图。
>
> 代码现状（必须先读）：当前 `generate_image` 是**文生图**，不是图生图。它只接收 `brief` 和 `alt` 两个文本参数，向 `{baseUrl}/images/generations` 发送 `{model, prompt, n:1, size:'1024x1024', response_format:'b64_json'}`；没有原图、画布比例、主色和风格强度参数；产物固定登记为 `role: 'article'`，并受每轮 2 张、素材总数 <6、单张 120 秒超时的限制。下面的配方定义的是**图生图接口契约**；在当前工具上无法保证保留原图可识别内容，也无法生成非 1:1 比例。哪个服务或版本支持图生图，未确认。
>
> 范围：本文件只定义配方，不新增依赖、不联网、不生成图片；执行时的接口调用由现有或后续生图服务负责。

## 用途与配方对应

| 用途 | 选用配方 | 说明 |
|---|---|---|
| 标题海报底图 | 配方 1（氛围底图） | 只生成无文字底图，标题和副标题由代码绘制 |
| 正文配图 | 配方 2（主体纪实） | 保留主体，不做风格化改写 |
| 公众号封面 2.35:1 | 配方 1 或配方 3 | 照片氛围强选 1，画面简洁选 3 |
| 公众号封面 1:1 | 配方 3（品牌横幅） | 方形构图，文字由代码另叠 |
| 文章首图 | 配方 3（品牌横幅） | 细长横幅；品牌名/logo 不生成，由已有素材另行放置 |

---

## 配方 1：氛围底图（Atmosphere Backplate）

### 1. 名称与适用场景

用于标题海报底图和 2.35:1 封面；重点是氛围、留白和可叠加标题的干净区域。

适合：横向的风景、建筑、空间、活动现场、光影或材质照片；主体可以轻微裁切；原图长边 ≥1600px；画面没有必须保留的小字或 logo。  
不适合：人脸必须清晰可辨的肖像；画面依赖招牌、屏幕、菜单等文字信息的照片；严重欠曝、模糊、噪点多；竖图裁成 2.35:1 会丢掉主体的照片；主体紧贴边缘的照片。

### 2. 输入

- **原图**：用户上传的原始照片；作为图生图输入图传入，而不是只在提示词里描述。当前 `generate_image` 没有原图字段（未确认其他接口）。
- **画布比例**：`677:300`（正文标题卡）、`900:383`（2.35:1 封面）、`1:1`（方形封面）。
- **主色**：从原图提取 1–2 个主色，格式 `#RRGGBB`；只允许原图已有的色相。当前 `generate_image` 不接收主色参数（未确认其他接口）。
- **风格强度**：`0.25–0.4`（低到中）；只做轻微调色、裁切、降噪和明暗整理。当前 `generate_image` 不暴露风格强度（未确认其他接口）。
- **提示词变量**：`{{title}}` 只用于理解主题，`{{mood}}` 描述情绪，`{{ratio}}` 指定比例；标题文字不得被渲染。

### 3. 提示词模板

**中文**

```text
以用户提供的原始照片为唯一内容参考，生成一张用于公众号标题海报底图/封面的抽象氛围底图。
主题：{{title}}（只用于理解画面主题，不要把标题文字渲染到画面里）。
情绪：{{mood}}。
画布比例：{{ratio}}。
保留原图中可识别的主体、场景和空间关系，只做轻微调色、裁切、降噪和明暗整理；不要风格化重绘，不要改变建筑、人物、物体或地标。
画面只允许纯色块、矩形、圆形、细线等几何装饰；不要具象插画、卡通、3D 渲染、霓虹光效或与原图无关的元素。
画面中绝对不要出现任何文字、汉字、字母、数字、标点、logo、水印、签名、二维码。
为标题留出画面 8%–92% 宽、10%–80% 高的安全区，保持低对比、干净、无高频细节；视觉重心放在右侧或底部边缘。
配色只从原图提取主色和辅色，不引入原图没有的色相；允许调整明度和饱和度。
```

**English**

```text
Using the user's original photo as the only content reference, create an abstract atmospheric background for a WeChat article title poster or cover.
Theme: {{title}} (context only; never render the title text in the image).
Mood: {{mood}}.
Aspect ratio: {{ratio}}.
Preserve the recognizable subject, scene, and spatial relationships; only allow subtle color grading, cropping, noise reduction, and tonal cleanup. Do not stylize, redraw, or alter buildings, people, objects, or landmarks.
Use only flat geometric decorations: color blocks, rectangles, circles, and thin lines. No illustrations, cartoons, 3D renders, neon effects, or elements unrelated to the source.
Absolutely no text, Chinese characters, letters, numbers, punctuation, logos, watermarks, signatures, or QR codes.
Reserve a title-safe area from 8% to 92% of the width and 10% to 80% of the height; keep it low-contrast, clean, and free of high-frequency detail. Place the visual accent at the right or bottom edge.
Extract the palette from the source photo only; do not introduce hues that are not present in the source. Adjusting lightness and saturation is allowed.
```

### 4. 硬约束

- 保留原图的可识别内容，不做风格化改写。
- 画面中不得出现任何文字、字母、数字、logo、水印。
- 为标题留出的安全区为画面 8%–92% 宽、10%–80% 高，该区域保持低对比、无高频细节。
- 配色必须从原图提取，不引入与原图无关的色相。

### 5. 后处理参数

- **裁切比例**：`677:300`、`900:383`、`1:1`；按目标比例居中裁切，主体偏离中心时允许轻微平移裁切。
- **长边像素**：正文 `1354px`、2.35:1 封面 `1800px`、1:1 `400px`（均为 2x）；`saveImage` 的硬上限是 2200px。
- **导出格式与质量**：PNG；`saveImage` 统一转 PNG，无 JPEG 质量参数；不要用低质量 JPEG 再转 PNG。
- **体积目标**：正文 ≤2MB、封面 ≤3MB、1:1 ≤1MB；代码只强制单张 ≤5MB。
- 当前 `generate_image` 固定返回 1024×1024，无法直接得到 1800×766；需要图生图接口支持目标比例和更大画布，未确认。

### 6. 失败判据

- 原图主体、场景或地标不可识别，或构图被明显重绘 → 失败。
- 画面出现任何文字、字母、数字、logo、水印、签名、二维码 → 失败。
- 标题安全区出现高对比、高频细节，叠字后不可读 → 失败。
- 颜色出现原图没有的色相（霓虹、紫绿偏色等） → 失败。
- 比例错误、长边低于 1200px、文件超过 5MB、图片无法解码 → 失败。
- 接口超时（单张 120 秒）、返回非 200、没有 `b64_json` → 失败。
- 接口没有接收原图，结果无法证明是原图加工 → 按失败/不适用处理。

重试或降级：最多重试 1 次，降低风格强度、加强“无文字/保留原图”的约束；仍失败就改用原图作为底图（如果安全区可用），或改用纯色/HTML 标题卡，并在设计说明中标注“底图未加工”。

---

## 配方 2：主体纪实（Subject Documentary）

### 1. 名称与适用场景

用于正文配图；重点是保留人物、产品或事件的可识别细节，不做风格化改写。

适合：人物、产品、活动、工作现场等有明确主体的照片；主体清晰、光线正常、原图长边 ≥1200px；画面没有必须保留的文字或 logo。  
不适合：海报、截图、菜单、屏幕等文字密集的图；带 logo/水印的图；严重模糊、噪点、逆光；多人合影且每个人都要保留；需要精确还原身份、服装或产品细节的新闻/证据类照片（生成模型可能改变细节，未确认）。

### 2. 输入

- **原图**：用户上传的原始照片；作为图生图输入图传入。当前 `generate_image` 没有原图字段（未确认其他接口）。
- **画布比例**：`4:3`、`3:2`、`1:1`；一篇内尽量统一，不要每张图换比例。
- **主色**：从原图提取 1–2 个主色，格式 `#RRGGBB`；保持人物肤色和产品固有色。当前 `generate_image` 不接收主色参数（未确认其他接口）。
- **风格强度**：`0.1–0.2`（极低）；只允许轻微调色、裁切、降噪和明暗整理。当前 `generate_image` 不暴露风格强度（未确认其他接口）。
- **提示词变量**：`{{title}}` 只用于理解文章主题，`{{mood}}` 描述情绪，`{{ratio}}` 指定比例；不要渲染标题。

### 3. 提示词模板

**中文**

```text
以用户提供的原始照片为唯一内容参考，生成一张公众号正文配图。
主题：{{title}}（只用于理解内容，不要渲染文字）。
情绪：{{mood}}。
画布比例：{{ratio}}。
保留原图的主体、人物/产品/场景的可识别特征和空间关系；只做轻微调色、裁切、降噪和明暗整理，不做风格化改写，不改变面部、服装、产品细节或事件事实。
画面中绝对不要出现任何文字、汉字、字母、数字、标点、logo、水印、签名、二维码。
正文配图不叠标题，标题安全区为 0%；不要把画面做成带标题的海报。
配色只从原图提取，不引入原图没有的色相；保持人物肤色和产品固有色。
```

**English**

```text
Using the user's original photo as the only content reference, create a body image for a WeChat article.
Theme: {{title}} (context only; do not render text).
Mood: {{mood}}.
Aspect ratio: {{ratio}}.
Preserve the recognizable subject, people/product/scene, and spatial relationships; only allow subtle color grading, cropping, noise reduction, and tonal cleanup. Do not stylize or alter faces, clothing, product details, or the factual content of the event.
Absolutely no text, Chinese characters, letters, numbers, punctuation, logos, watermarks, signatures, or QR codes.
This is a body image, not a title poster: reserve 0% title area and do not add a title.
Extract the palette from the source only; do not introduce hues that are not present. Keep skin tones and product colors faithful.
```

### 4. 硬约束

- 保留原图的可识别内容，不做风格化改写。
- 画面中不得出现任何文字、字母、数字、logo、水印。
- 正文配图不叠标题，标题安全区为 0%。
- 配色必须从原图提取，不引入与原图无关的色相。

### 5. 后处理参数

- **裁切比例**：`4:3`、`3:2`、`1:1`；按主体位置裁切，不要切掉人物的头、手或产品的关键部位。
- **长边像素**：1600–2000px；`saveImage` 的硬上限是 2200px；原图不足 1600px 时不要强行放大。
- **导出格式与质量**：PNG；`saveImage` 统一转 PNG；不要用低质量 JPEG 再转 PNG。
- **体积目标**：单张 ≤2.5MB；代码只强制 ≤5MB。
- 当前 `generate_image` 固定 1024×1024；如果只能拿到 1024px，按 1x 使用，不要声称达到 2x。

### 6. 失败判据

- 主体、面部、服装、产品或事件细节被明显改变、替换或变得不可识别 → 失败。
- 画面出现任何文字、字母、数字、logo、水印、二维码（包括原图招牌上的文字） → 失败；如果照片的含义依赖招牌文字，这个配方不适用。
- 裁切切掉主体头部、手部、产品关键部位或重要环境 → 失败。
- 肤色、产品固有色偏移，或出现原图没有的色相 → 失败。
- 比例错误、长边低于 1200px、文件超过 5MB、无法解码 → 失败。
- 接口超时、返回非 200、没有 `b64_json` → 失败。
- 接口没有接收原图，结果无法证明保留原图内容 → 按失败/不适用处理。

重试或降级：最多重试 1 次，把风格强度降到最低、加强“保留主体/无文字”的约束；仍失败就直接用原图作为正文配图（通过 `update_article_assets` 登记），并在设计说明中标注“配图未加工”。

---

## 配方 3：品牌横幅（Brand Banner）

### 1. 名称与适用场景

用于文章首图和 1:1 封面；重点是横向/方形的干净构图和中央标题安全区，不生成任何品牌文字或 logo。

适合：构图简单、留白充足、横向的风景、空间、桌面、材质或活动照片；原图长边 ≥1600px；主体可以放在边缘或被轻微裁切。  
不适合：需要展示公众号 logo、账号名或二维码的照片；文字密集的招牌/屏幕；主体在画面正中央且不能被标题遮挡的人像；竖图裁成 3:1/4:1 会丢掉主体的照片。

### 2. 输入

- **原图**：用户上传的原始照片；作为图生图输入图传入。当前 `generate_image` 没有原图字段（未确认其他接口）。
- **画布比例**：`3:1`（文章首图横幅）、`4:1`（更细的横幅）、`1:1`（方形封面）。
- **主色**：从原图提取 1–2 个主色，格式 `#RRGGBB`；不允许把品牌色强行混进原图没有的色相。当前 `generate_image` 不接收主色参数（未确认其他接口）。
- **风格强度**：`0.2–0.35`（低）；只做轻微调色、裁切、降噪和明暗整理。当前 `generate_image` 不暴露风格强度（未确认其他接口）。
- **提示词变量**：`{{title}}` 只用于理解主题，`{{mood}}` 描述情绪，`{{ratio}}` 指定比例；标题和品牌名不得渲染。

### 3. 提示词模板

**中文**

```text
以用户提供的原始照片为唯一内容参考，生成一张公众号文章首图/方形封面的无文字底图。
主题：{{title}}（只用于理解主题，不要渲染文字）。
情绪：{{mood}}。
画布比例：{{ratio}}。
保留原图的主体、场景和可识别特征；只做轻微调色、裁切、降噪和明暗整理，不做风格化改写。
画面中绝对不要出现任何文字、汉字、字母、数字、标点、logo、水印、签名、二维码；品牌名和 logo 不生成，由已有素材另行放置。
为标题留出中央 70% 宽 × 60% 高的安全区（x 15%–85%, y 20%–80%），保持低对比、干净；视觉元素放在四周边缘。
配色只从原图提取，不引入原图没有的色相；允许调整明度和饱和度。
```

**English**

```text
Using the user's original photo as the only content reference, create a text-free base image for a WeChat article header banner or square cover.
Theme: {{title}} (context only; never render the title text).
Mood: {{mood}}.
Aspect ratio: {{ratio}}.
Preserve the recognizable subject, scene, and spatial relationships; only allow subtle color grading, cropping, noise reduction, and tonal cleanup. Do not stylize or redraw.
Absolutely no text, Chinese characters, letters, numbers, punctuation, logos, watermarks, signatures, or QR codes. Do not generate brand names or logos; they must come from existing assets placed separately.
Reserve a title-safe area of 70% width × 60% height in the center (x 15%–85%, y 20%–80%); keep it low-contrast and clean. Place visual elements near the edges.
Extract the palette from the source only; do not introduce hues that are not present. Adjusting lightness and saturation is allowed.
```

### 4. 硬约束

- 保留原图的可识别内容，不做风格化改写。
- 画面中不得出现任何文字、字母、数字、logo、水印。
- 为标题留出的安全区为中央 70% 宽 × 60% 高（x 15%–85%, y 20%–80%）。
- 配色必须从原图提取，不引入与原图无关的色相。

### 5. 后处理参数

- **裁切比例**：`3:1`（1800×600，2x）、`4:1`（1800×450，2x）、`1:1`（400×400，2x；逻辑 200×200）。
- **长边像素**：横幅 1800px；1:1 400px；`saveImage` 的硬上限是 2200px。
- **导出格式与质量**：PNG；`saveImage` 统一转 PNG；不要用低质量 JPEG 再转 PNG。
- **体积目标**：横幅 ≤2MB、1:1 ≤500KB；代码只强制单张 ≤5MB。
- 当前 `generate_image` 固定 1024×1024：裁成 3:1 只有 1024×341，达不到 2x 横幅；不要用它冒充 1800×600，需图生图接口支持目标比例（未确认）。

### 6. 失败判据

- 中央 70%×60% 安全区不干净、对比过强，叠标题后不可读 → 失败。
- 画面出现任何文字、字母、数字、logo、水印、二维码 → 失败。
- 3:1/4:1 裁切切掉主体，或 1:1 裁切切掉主体 → 失败。
- 出现原图没有的色相，或品牌色与原图冲突 → 失败。
- 比例错误（例如只返回 1024×1024 且裁切后主体不完整） → 失败。
- 接口超时、返回非 200、没有 `b64_json`、文件超过 5MB → 失败。
- 首图必须展示公众号 logo/账号名，而本配方被要求生成它们 → 失败/不适用；logo 和文字必须来自已有素材，另行动画/排版，不由生图模型生成。

重试或降级：最多重试 1 次，降低风格强度并加强“无文字/中央安全区”的约束；仍失败就让首图改用原图，封面改用原图或纯色标题卡，并在设计说明中标注“横幅/封面未加工”。

---

## 与现有流程的衔接

### 1. 生图产物落盘后如何变成可被引用的素材

**A. 走 `generate_image` 的自动登记**

1. 生图接口返回 `data[0].b64_json`，`generate_image` 调用 `saveImage`，把图片写成任务目录下的 `assets/<uuid>.png`，返回 `{ id, file, width, height, source: 'generated' }`。
2. 工具把该对象追加到 `job.assets`，并写回 `job.json`。
3. 工具返回的 JSON 里带 `src: "asset://<id>"`。
4. 正文 HTML 用 `asset://<id>` 引用；`validateArticle` 会把它映射成 `assets/<file>`。

**B. 走 `update_article_assets` 的手动登记（例如 P4 canvas 或外部接口产出的 PNG）**

1. 先把 PNG 放到当前工作区（不要放进 `data/`，也不要手改 `job.json`）。
2. 调用 `update_article_assets`，传 `image_path`（工作区路径）和 `role: "article"`；桌面入口也支持本轮聊天图片的 `image_index`。
3. 工具通过 `saveWorkspaceImage` → `saveImage` 写入 `assets/<uuid>.png`，更新 `job.assets` 和 `job.json`，返回带 `asset://<id>` 的素材列表。
4. 正文 HTML 用 `asset://<id>`；不要写本地路径或 base64。

**C. 封面和标题海报的特殊情况**

- 封面不在正文 HTML 里，不需要 `asset://` 登记；在公众号后台手动上传即可。
- 标题海报 PNG 是独立交付物，手动拖入正文；作为 canvas 中间层的底图也不需要登记，除非它本身要作为正文图片出现。
- 重要限制：当前 `generate_image` 固定把产物登记为 `role: 'article'`，而 `validateArticle` 要求所有 `article` 素材都在正文出现；如果只用 `generate_image` 生成封面/海报底图而不放进正文，校验会报“请保留所有指定为文章配图的素材”。当前没有单独的 role 修改入口（未确认）；这类不进入正文的底图需要走不登记为 article 的图生图入口（是否存在未确认）。

### 2. 单张生成预计耗时与超时上限

| 项目 | 值 | 依据/状态 |
|---|---|---|
| 单张 API 调用上限 | 120 秒 | `generate_image` 的 `AbortSignal.timeout(120_000)` |
| 每轮生图上限 | 2 张 | `imageCalls > 2` 时拒绝 |
| 每篇素材上限 | 生成前 `assets.length < 6`；更新后 ≤6 | `generate_image` / `update_article_assets` |
| Web 任务总超时 | 300 秒 | `server.mjs` 的 `finishJob` |
| 预计单张耗时 | 30–90 秒（未实测，未确认） | 取决于模型和网络；不是代码承诺 |
| 策划子 Agent 耗时 | 未确认 | `generate_image` 会先启动生图策划子 Agent |

### 3. 接口失败时的降级路径

1. **先判断失败类型**：HTTP 非 200、没有 `b64_json`、base64 超过 7,000,000 字符、超时、图片无法解码、超过 5MB、画面出现文字/logo、主体不可识别，都算失败。
2. **最多重试 1 次**：降低风格强度、加强“保留原图/无文字/安全区”的提示词；如果服务未配置、用户未允许生图或权限错误，不重试。
3. **正文配图降级**：直接使用原图，通过 `update_article_assets` 登记为 `role: "article"`，在 `notes` 里写“配图生成失败，已使用原图”。
4. **标题海报降级**：底图改用原图（安全区可用时）或纯色/HTML 标题卡；在 `notes` 里写“海报底图未生成”。
5. **封面降级**：封面改用原图或纯色图，在公众号后台手动设置；在 `notes` 里写“封面未加工”。
6. **整篇不失败**：生图失败不应阻断 `submit_article`；如果没有任何可用图片，正文改为纯文字排版，并在交付说明中列出缺失项，不能伪造图片或声称已生成。

## 来源说明

本文件的工作流结构参考了公开的 zine / editorial 类提示词配方，但提示词为本项目原创撰写；不复制他人仓库文件。
