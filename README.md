# Bloop · 公众号设计桌面 Agent

基于 DeepSeek Harness 0.2.1-rc.2 源码构建 macOS 桌面版本，另提供 Windows x64 源码启动版。启动后直接进入可输入的新对话，固定使用本项目目录，左侧平铺历史对话；公众号插件和设计技能随会话加载。保留内置的文件、搜索、子 Agent、附件、预览和文件交付功能，默认隐藏历史侧栏，鼠标靠近左边缘时展开。左下角设置按钮直接打开设置页，导航只显示通用和模型，通用里的 Permission 保留。

## 现在怎么运行

本机已经安装依赖并配置主模型。双击上级目录的 **Bloop.app** 即可打开修改后的桌面界面，已完成正常退出后由系统直接打开的冷启动验证。也可以双击 **启动Bloop.command**，或在此目录运行 `npm start`。这些入口均加载本项目的独立配置。上级目录的原版 `DeepSeek Harness.app` 提供本地运行环境，请保留。

打开后直接输入正文和设计要求，无需选择文件夹、启用公众号插件或指定技能名称。启动器默认关闭开发者工具的自动弹出。可以通过内置附件入口上传图片，也可指定项目目录内的 PNG、JPG、WebP 文件。当前每篇上限六张、单张 5 MB、正文 16000 字。一篇文章使用一个会话。首版应用重启后会打开新对话，旧对话仍保留在历史中；暂未恢复旧文章任务的业务工具状态，重启后请在新对话中提供要修改的稿件。

示例请求：

> 把这段原文排成微信公众号文章，保留全文，使用墨绿与暖橙配色。配图使用 examples/walk-reference.png，先识别图片，不生图。完成后交付 HTML 和预览。

示例正文位于 `examples/示例原文.txt`；示例图片是程序绘制的测试素材，不是 AI 生图结果。

## 实际流程

1. 主 Agent 已加载 `gzh-design` 全文，按用户需求调用 `gzh_prepare_article` 建立本会话任务。
2. 有图片时，`inspect_images` 启动真实 Harness 子 Agent，并将图片字节作为多模态输入，返回识别与风格分析。
3. 主 Agent 根据原文和要求自主设计，以内联样式生成公众号正文。没有固定主题数量限制。
4. 用户允许生图且已配置图像服务时，`generate_image` 委派插图策划子 Agent，再请求实际图片生成 API，保存图片文件。
5. `submit_article` 检查正文覆盖、图片引用和主动内容，通过后保存文件。失败不会覆盖上次成功的正文；同一会话继续修改时会备份成功版本。
6. 内置 `present` 交付正文与预览文件。

输出保存在工作区 `gzh-output/<任务ID>/`：

- `article.html`：公众号正文片段，样式内联。
- `preview.html`：图片内嵌的独立预览与富文本复制入口，在原生侧栏也能显示配图。
- `assets/`：本任务使用的实际 PNG 素材，和 HTML 一起保留。
- `job.json`、`vision.txt`、`submission.json`：原文、识别结果和设计说明。
- `versions/`：后续修改时的旧稿快照。

复制到公众号后仍须检查图片：本地图片路径不会自动变成微信素材地址，本版不含登录、素材上传或自动发布。请在公众号后台上传配图，并做手机预览。

## 模型和密钥

`data/settings.json` 为本机私有配置，权限 0600，整个 `data/` 已被 Git 忽略。共享项目时使用无密钥的 `settings.example.json`，复制到 `data/settings.json` 后填写自己的凭据。

- `main`：主模型，当前为 DeepSeek `deepseek-flash`。
- `vision`：留空继承主模型，可另外指定支持视觉输入的兼容接口。
- `image`：独立生图服务的 `baseUrl`、`model`、`apiKey`。DeepSeek 主模型 API Key 不等于已配置生图服务。

生图端目前支持 OpenAI 兼容的 `POST <baseUrl>/images/generations`、1024×1024、`data[0].b64_json` 响应。仅返回 URL 的服务尚未接入。没有配置时会返回明确错误，不能以占位图冒充生成成功。

桌面配置保存在 `data/desktop-home/profiles/desktop/cordis.patch.yml`，首次启动时初始化，之后保留用户在插件和模型页面中的修改。默认加载主模型路由、公众号插件、设计技能和原有内置功能插件。额外会话日志上传被关闭，原有审批机制保留。需要独立凭据、额外依赖或更宽权限的实验插件不随界面简化自动启用。修改模型路由后以原生模型设置为准；编辑业务插件代码后退出应用并重新启动。

## 工程结构和验证

| 文件 | 职责 |
| --- | --- |
| `desktop-plugin.mjs` | 原生会话接入、文字与附件归档、会话内业务工具注册 |
| `harness-plugin.mjs` | 视觉/插图子 Agent、真实生图请求、检查与保存 HTML |
| `.agents/skills/gzh-design/SKILL.md` | 公众号设计流程、内容与图片使用约束 |
| `lib/article.mjs` | HTML 清洗、原文覆盖与素材引用检查、预览外壳 |
| `lib/storage.mjs` | 图片真实解码、限额、文件与私有配置 |
| `scripts/start-desktop.mjs` | 单工作区桌面启动与独立配置 |
| `scripts/build-desktop.mjs` | 从本地构建产物生成桌面入口，检查目录配置与应用签名 |
| `lib/model-route.mjs` | 启动器与文章运行时共用的模型路由配置，不加载图片原生库 |

`npm test` 覆盖 HTML 安全、内容遗漏、图片真实解码、凭据脱敏、桌面内置工具保留、附件与子 Agent 委派、版本保留，以及通过真实 Harness 运行时连接测试接口的完整链路。本机还使用应用自带的签名 Node 检查启动模块导入，避免启动器间接加载原生图片库而触发签名错误；缺少该 macOS 运行环境时仅跳过这一项。测试接口生成的图片只用于连接验证。

另已使用实际 DeepSeek 接口验证原文 + 示例图 → 视觉子 Agent → HTML 保存，测试结果在本地 `data/projects/c8ed453f-9a3b-4fdc-86ec-afafecef12fb/`。测试输出未计入 Git。官方桌面也已完成真实识图、校验失败后的修复、内置 present 文件交付和侧栏图文预览；本机成品位于 gzh-output/054df0a7-ee68-49cc-b34c-4ad87a8e30c7/。真实生图尚待配置服务后验证。

源码底座为上级目录 `deepseek-harness`，界面改动通过构建变量 `DSH_CLIENT_WORKSPACE_PATH` 启用；不设置该变量时保留 Harness 原来的工作区界面。NPM SDK 暂为 0.2.0-rc.2，插件在子 Agent 调用处兼容两版接口。

修改 Harness 界面后，在 `deepseek-harness` 目录执行以下命令，再回到本目录运行 `npm run build:desktop`。单独修改业务插件无需重建界面。

```sh
DSH_CLIENT_BLOOP=1 DSH_CLIENT_WORKSPACE_PATH="$(cd ../gzh-agent && pwd)" DSH_CLIENT_TITLE='Bloop' node node_modules/pnpm/bin/pnpm.cjs run build:artifacts
node node_modules/pnpm/bin/pnpm.cjs run build:check
```

桌面构建复用官方应用中的 Electron 和 Node 运行环境，对独立副本进行本地签名，不覆盖官方应用。当前 `.app` 是本机开发入口，依赖同级源码、项目目录和官方运行环境，不是可分发的独立安装包。移动整个文件夹后需重新构建界面和桌面入口。

此前的 `public/`、`server.mjs`、`lib/harness.mjs` 作为 Web 原型和运行验证保留，默认不启动；手动体验入口是 `npm run start:web-prototype`，后续工作以当前桌面版为准。

## 新电脑准备

需要 macOS Apple Silicon、Node.js 24+、本目录 `npm ci` 安装业务依赖，并把官方 DeepSeek Harness `.app` 和 Harness 源码放在项目上一级。在 Harness 源码目录安装工作区依赖并按上述命令构建，然后在本目录运行 `npm run build:desktop`。官方下载入口为 https://deepseek.com/harness/ 。Mac 入口仍依赖上述本地环境；Windows 源码启动版见下文。

## 两天开发的后续顺序

五个人可以分别负责：公众号真实粘贴验收、视觉输入与图片管理、生图服务接入、提示词/设计质量、桌面打包和演示回归。先用同一组原文验收纯文字、文章配图、参考图、图片文字、一次追改和失败保留旧稿，再扩展主题组件或批量功能。

本版不加入账户系统、云任务队列、批量文章或自动发布。原文覆盖检查按段落归一化匹配，不能替代编辑审稿；字体、样式和图片仍以微信后台和手机实际显示为准。

## 参考项目许可证

业务插件与 Skill 为独立编写，沿用本仓库 MIT。`gzh-design-skill` 是 AGPL-3.0-or-later，本版未复制它的脚本或组件；后续直接复用前应处理相应许可要求。`html2canvas` 是 MIT，本版最终输出 HTML，暂不引入截图渲染依赖。

## Bloop 界面

空白对话显示动态伙伴和十二组中英文问候之一；开始任务后，同一只伙伴以 1.3 秒的平移和缩放过渡移动到左上角，保留较大尺寸，持续循环十二种动作、形态、环绕轨迹和粒子效果。系统减少动态效果设置会暂停装饰动画。创建按钮英文为 New Task，中文为新对话。侧栏在鼠标进入左侧 56px 区域时展开，键盘聚焦也可打开。构建版本标识、原欢迎标题、Standard mode、Tools 和输入框权限按钮均已隐藏；会话标题、Chat/Trajectory 标签与右上角工具也不显示，权限规则继续执行。

宠物代码来自 https://github.com/jeremy-prt/bloub ，保留 MIT 署名和许可证，副本位于 `third-party/bloub-LICENSE`；动画核心及准确来源版本保存在 Harness 的 `ui-conversation/src/client/bloop/` 中。新应用图标由同一 SVG 核心生成，无需下载外部素材。

## Windows x64 源码启动版

Windows 入口是仓库根目录的 `启动Bloop.cmd`。这是首次运行会构建环境的源码启动版，目前没有独立 EXE 安装包或代码签名。安装 Node.js 24 LTS、Git for Windows 后，将仓库解压到可写目录，双击该脚本。首次准备还需要 Python 3.12、Visual Studio 2022 Build Tools 的 C++ 桌面开发组件和 Windows SDK，以编译 Harness 的 Windows 原生模块。需要可访问 npm、GitHub、nodejs.org 等依赖下载源；完整内置运行环境首次下载和编译较大，请预留充足磁盘空间并保持联网。

脚本会安装业务依赖，拉取 `harness.json` 固定的源码版本，应用 `patches/bloop-harness.patch`，编译 Bloop 前端并准备 Windows Electron 与原生运行环境，再打开桌面窗口。后续同目录启动复用构建。目录移动或补丁变化时重新构建；构建失败保留日志，不会删除用户配置。

Windows 私有配置、模型凭据、历史和编译缓存均在 `data/`，不提交到 Git。首次启动可在设置 → 模型中配置自己的服务；额外识图和生图服务仍可在 `data/settings.json` 配置。不要将 Mac 的 `data/` 或 `node_modules/` 复制到 Windows。

GitHub Actions 的 `Bloop Windows` 工作流在 Windows x64 上执行业务测试、原生构建和桌面窗口启动检查，通过后上传 `Bloop-Windows-x64-source`。该 ZIP 是无密钥源码启动包，不是预编译安装包；下载后仍需上述首次准备。工作流通过只证明构建和开窗，不等于 Windows 上真实模型对话、图片生成或公众号复制的端到端验收。

## 源码和许可证

本仓库保存公众号业务代码、Bloop 图标、Windows 启动器，以及针对固定 Harness 提交的完整补丁，包含前端源码和宠物引擎。上游 MIT 许可和宠物许可保存在 `third-party/`；密钥、历史、输出文章和本机安装缓存不进入版本库。
