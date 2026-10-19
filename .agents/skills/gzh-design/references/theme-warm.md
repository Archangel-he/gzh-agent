# Warm：照片叙事与轻刊物

适合校园、旅行与人物故事；照片与原文叙事共同建立风格。用户给了喜欢的成稿时，先读它的关系：照片占比、背景、字体角色、段落密度、章节开场与结尾，不只抽一个颜色。昨日银杏稿的优点是米白、暖金、宋体与六张照片连贯；不是所有文章都要变成金色。

## 先确定画布与节奏

从现有照片选一张开篇照片，选择能配合照片的纸色、正文色与一个强调色。下面的暖金仅示例；用户明确色板与参考优先。标题用一种中文字体，正文可用系统黑体；不要把全部正文都变成大宋体，不默认给每行标题换效果。

外层 section 管理整篇底色，padding:0；照片与文字区作为同级块。文字区自己设置左右20–24px内边距，首图可以通栏。交付页面不额外加白框或留白，因此要把设计需要的纸色与边距写进正文HTML。别用负边距抵消预览器，复制到公众号后会错位。

选有目的的三种变化：开篇通栏照片；中段纸框或偏右小照片；结尾较小居中照片与短句。数量不足时不硬凑，不重复照片冒充不同场景。章间可有50–64px留白，段间22–28px。短文按长度减小留白。正文16px/2左右，长段左对齐；仅真实短句居中。

## 开篇：摄影＋刊物标题

```html
<section style="background-color:#fffdf8;padding:0;color:#3b332b;">
<img src="asset://素材ID" alt="实际照片内容" style="width:100%;margin:0;">
<section style="padding:30px 22px 12px;text-align:center;">
<h1 style="margin:0 0 14px;font-family:'Songti SC',SimSun,serif;font-size:30px;font-weight:700;line-height:1.5;letter-spacing:2px;color:#2c2720;">文章原标题</h1>
<p style="margin:0 0 24px;font-size:14px;line-height:1.9;color:#8c7a5e;">原文确有的副标题，没有则删除。</p>
<p style="margin:0;border-top:1px dashed #e2ce9e;"></p>
</section>
<section style="padding:18px 22px 26px;">
<p style="margin:0 0 24px;font-size:16px;line-height:2.05;letter-spacing:0.5px;">完整原文开场。</p>
</section>
</section>
```

## 章节：延续字体、改变对齐与呼吸

只在真正章节处使用。左右交替是可选节奏，不要让每段都左右跳。章标题超过一行时保留自然断行；不要缩成难读小字。不强制每章加英文、序号与细线三件套。

```html
<section style="margin:56px 0 26px;padding:0 22px;">
<p style="margin:0 0 14px;border-top:1px dashed #e2ce9e;"></p>
<h2 style="margin:0;font-family:'Songti SC',SimSun,serif;font-size:21px;font-weight:700;line-height:1.6;letter-spacing:1px;color:#2c2720;text-align:right;">来自用户原文的完整章节标题</h2>
</section>
```

## 图片：纸框与偏置小幅

照片与附近文字相关。相邻照片可有不同大小，但不把所有图片缩成小卡片。使用外层宽度和padding，不修改原始照片。下例置于整篇画布中；通栏照片无需套纸框。

```html
<section style="margin:26px 22px 0;">
<section style="width:74%;margin-left:auto;padding:8px;background-color:#ffffff;border:1px solid #f0e5ce;">
<img src="asset://素材ID" alt="实际照片内容" style="width:100%;margin:0;">
</section>
<p style="margin:10px 0 28px;text-align:right;font-size:13px;line-height:1.8;color:#887b66;">原有或可核实的图注。</p>
</section>
```

## 短句：把重点留给文字

只用原文，普通叙述不擅自改写成诗。不要同时堆彩底、边框、描边、印章与大引号。

```html
<section style="padding:24px 26px 38px;text-align:center;">
<p style="margin:0;font-family:'Songti SC',SimSun,serif;font-size:18px;line-height:2.1;letter-spacing:1px;color:#6e5f49;">来自用户原文且确实存在的短句。</p>
<p style="margin:20px auto 0;width:36px;border-top:1px solid #d3b26b;"></p>
</section>
```

交付前检查首屏、一次章节转场和图片组合；正文留白与照片比例比装饰数量重要。无生图接口照样能完成这套排版。生图只补确实需要的插画或氛围素材，不负责让字体与留白自动变好，不生成虚假的纪实现场。
