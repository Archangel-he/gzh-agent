import sanitizeHtml from 'sanitize-html';
import { Parser } from 'htmlparser2';

export const themes = {
  editorial: { name: '墨绿刊读', color: '#174c43', tint: '#edf3ef' },
  warm: { name: '暖纸叙事', color: '#994d32', tint: '#faf0e6' },
  blue: { name: '蓝色简报', color: '#285e9c', tint: '#edf3fa' },
};

export const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const tags = ['section', 'p', 'span', 'strong', 'em', 'u', 's', 'br', 'img', 'blockquote', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'h1', 'h2', 'h3', 'h4', 'pre', 'code', 'hr'];
const properties = ['color', 'background', 'background-color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-decoration', 'text-indent', 'white-space', 'word-break', 'overflow-wrap', 'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-color', 'border-radius', 'border-collapse', 'width', 'max-width', 'height', 'vertical-align', 'display'];
const allowedStyles = Object.fromEntries(properties.map(p => [p, [/^[#\w\s.,()%/+'"\-\u3400-\u9fff]+$/]]));
const textOf = html => { let text = ''; const parser = new Parser({ ontext(value) { text += value; } }); parser.end(html); return text; };
const normalize = text => text.normalize('NFKC').replace(/[\p{P}\p{S}\s]/gu, '').toLowerCase();

/** Sanitizes untrusted model HTML and checks local asset references and source coverage. */
export function validateArticle(raw, { assets = [], source = '' } = {}) {
  if (typeof raw !== 'string' || raw.length > 400_000) throw new Error('HTML 必须是少于 40 万字符的字符串。');
  const assetPaths = new Map(assets.map(a => [`asset://${a.id}`, `assets/${a.file}`]));
  for (const a of assets) assetPaths.set(`assets/${a.file}`, `assets/${a.file}`);
  const errors = [], warnings = [];
  if (/<\s*(?:script|iframe|object|embed|link|style)\b/i.test(raw)) errors.push('文章正文不能包含脚本、iframe、外部样式或 style 标签。');
  if (/\son[a-z]+\s*=/i.test(raw)) errors.push('文章中包含事件处理属性。');
  if (/\b(?:position\s*:|display\s*:\s*grid|var\s*\(|@import|expression\s*\()/i.test(raw)) errors.push('使用了不适合公众号正文的定位、grid、变量或动态样式。');
  const html = sanitizeHtml(raw, {
    allowedTags: tags,
    allowedAttributes: { '*': ['style'], img: ['src', 'alt', 'style'], a: ['href', 'style'], span: ['leaf', 'style'], td: ['colspan', 'rowspan', 'style'], th: ['colspan', 'rowspan', 'style'] },
    allowedStyles: { '*': allowedStyles },
    allowedSchemes: ['https', 'http'], allowProtocolRelative: false,
    transformTags: {
      img: (_tag, attrs) => {
        const src = assetPaths.get(attrs.src);
        if (!src) errors.push('图片必须引用本任务已经存在的素材 ID。');
        return { tagName: 'img', attribs: { src: src ?? '', alt: attrs.alt ?? '', style: 'max-width:100%;height:auto;display:block;margin:18px auto;' } };
      },
    },
  });
  const plain = textOf(html);
  if (plain.trim().length < 10) errors.push('正文为空或有效文字不足。');
  if (/\{\{[^}]+\}\}|插入图片|待补素材|图片URL/.test(plain)) errors.push('文章中仍有未填写的占位内容。');
  const cleanText = normalize(plain);
  const paragraphs = source.split(/\n+/).map(p => normalize(p)).filter(p => p.length >= 12);
  const missing = paragraphs.filter(p => !cleanText.includes(p));
  if (missing.length) errors.push(`原文有 ${missing.length} 段内容未完整保留，请保持原文实质内容并修复。`);
  if (assets.some(a => a.role === 'article' && !html.includes(`assets/${a.file}`))) errors.push('请保留所有指定为文章配图的素材。');
  warnings.push('公众号中的图片传输与实际样式仍需在后台和手机预览中检查。');
  return { html, errors: [...new Set(errors)], warnings, plain };
}

export function documentHtml(body, title, { preview = false } = {}) {
  const controls = preview ? '<div class="toolbar"><strong>公众号文章预览</strong><button onclick="copyArticle()">复制到公众号</button><span id="notice"></span></div>' : '';
  const script = preview ? `<script>async function copyArticle(){const el=document.querySelector('article');try{await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([el.innerHTML],{type:'text/html'}),'text/plain':new Blob([el.innerText],{type:'text/plain'})})]);document.querySelector('#notice').textContent='已复制。图片需在公众号后台检查。'}catch(e){const s=getSelection(),r=document.createRange();r.selectNodeContents(el);s.removeAllRanges();s.addRange(r);document.querySelector('#notice').textContent='请按 ⌘C 或 Ctrl+C 复制选中内容。'}}</script>` : '';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>body{margin:0;background:#f5f5f1;color:#222;font-family:system-ui,sans-serif}.toolbar{display:flex;gap:20px;align-items:center;padding:16px;background:white;position:sticky;top:0;border-bottom:1px solid #ddd;font-size:13px}button{border:0;border-radius:6px;padding:10px 16px;background:#174c43;color:white;cursor:pointer}article{max-width:720px;margin:24px auto;background:white;padding:32px;overflow-wrap:anywhere}img{max-width:100%}pre{white-space:pre-wrap}@media(max-width:600px){article{padding:20px;margin:0}.toolbar{flex-wrap:wrap}}</style></head><body>${controls}<article>${body}</article>${script}</body></html>`;
}

/** Explicitly non-AI mode for checking upload, preview and export without provider credentials. */
export function demoArticle(text, assets, themeId = 'editorial') {
  const theme = themes[themeId] ?? themes.editorial;
  const lines = (text || '一个周末，把想法变成作品\n\n这是一份本地体验示例。配置模型后，可以由 Agent 理解内容、识别图片并自主设计版式。').split(/\n+/).filter(Boolean);
  const title = lines[0].replace(/^#+\s*/, '').slice(0, 80);
  const body = lines.slice(1).map(line => `<p style="margin:0 0 18px;line-height:1.9;font-size:16px;"><span leaf="">${escape(line)}</span></p>`).join('');
  const images = assets.filter(a => a.role === 'article').map(a => `<img src="asset://${a.id}" alt="${escape(a.name)}">`).join('');
  return { title, html: `<section style="padding:10px 4px;color:#303b36;"><p style="color:${theme.color};font-size:12px;letter-spacing:3px;"><span leaf="">FIELD NOTES · 公众号排版</span></p><h1 style="font-size:27px;line-height:1.5;margin:20px 0 30px;color:${theme.color};"><span leaf="">${escape(title)}</span></h1>${body}${images}</section>` };
}
