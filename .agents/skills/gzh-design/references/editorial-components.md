# 公共组件：阅读优先

先读取选定主题；下面是 Bloop 自有的兼容结构示例。替换示例文字和素材 ID，不复制示例事实，不提交空占位。保持用户原文；自拟标题须基于原文，不能编造摘要/引言/引语。样式数值可以按主题覆盖，整体维持统一角色。

## 整篇画布

正文最外层 section 自己定义背景与布局，文字区自己设置左右20–24px padding；交付页面不再统一套白底与20px边距。需要通栏照片时，将照片与带padding的文字区并列放在画布内；不要靠负边距逃出白框。用户参考以照片和纸色为主时，再读 warm 的可用组合。

## 正文与章节

正文保持左对齐或按用户要求两端对齐，不默认把每句拆成独立卡片。首行缩进与明显段间距通常选一种为主要段落标记。不要将英文 45–75ch 行宽规则原样套给中文。

```html
<section style="margin:28px 0 0;">
<h2 style="margin:0 0 16px;font-size:20px;font-weight:700;line-height:1.5;color:#253b35;">原文章节标题</h2>
<p style="margin:0 0 18px;font-size:16px;line-height:1.9;color:#303733;">完整保留的原文段落。</p>
</section>
```

## 纪实照片与图注

图片默认 max-width:100%;height:auto;display:block;margin:18px auto;，自定义安全声明优先。可用 border-radius、border、width/height、object-fit/object-position 表达圆角、描边和显示裁切，也可用 box-shadow、opacity、aspect-ratio。外层保持正常文档流，不用定位叠字或伪元素。纪实图片默认保留完整主体与比例，只有设计要求确需裁切时调整显示，不能裁掉事实关键内容；原图文件保持不变。图注来源于原文或已识别的可信信息，未知人物地点不猜。

```html
<section style="margin:8px 0 24px;">
<img src="asset://素材ID" alt="基于实际图片内容的描述">
<p style="margin:0;font-size:13px;line-height:1.7;color:#646d67;">原有或可核实的图片说明</p>
</section>
```

不要在外层再叠加与 img 相同的大留白。图注可省略。图片不添加相框、圆角或底色也能形成清楚的阅读节奏。

## 引语

仅使用原文真实引语，区分引用与摘要；不要把作者普通叙述伪装成名言。一个强调已经足够，不同时用彩底、边框、超大引号、加粗和下划线。

```html
<blockquote style="margin:24px 0;padding:4px 0 4px 16px;border-left:3px solid #547267;color:#3d4d45;">
<p style="margin:0;font-size:17px;line-height:1.9;">来自原文的完整引语。</p>
</blockquote>
```

## 列表、表格与代码

有顺序的步骤用 ol，无顺序的并列项用 ul，不能为装饰给所有章节加 01/02。列表正文采用同一字体层级。宽表在窄屏会挤压，优先保留核心列；不能自行删事实，必要时拆成每项的键值段落，记录所有原数据。代码保持原样，可使用 pre/code 的白名单样式与 white-space:pre-wrap，注意折行改变的是显示而非代码内容。

```html
<ul style="margin:16px 0;padding-left:24px;font-size:16px;line-height:1.9;"><li style="margin-bottom:8px;">原文第一项</li><li>原文第二项</li></ul>
<table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.7;"><tbody><tr><th style="padding:10px;border-bottom:1px solid #d7dfda;text-align:left;">原列名</th><td style="padding:10px;border-bottom:1px solid #d7dfda;">原数据</td></tr></tbody></table>
```

## 节奏与强调

先用标题与段间距区分层级，再考虑一处强调。正文色保证可读，辅助文字不降为接近底色的浅灰；内容相同的角色保持同一字号与颜色。不要为填满页面增加副标题、英文翻译、序号、额外事实卡或结束语。用户原文很短时，简洁布局就是合适设计。
