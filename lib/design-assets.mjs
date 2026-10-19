import sharp from 'sharp';
import { escape } from './article.mjs';

/** Render original, code-drawn botanical title artwork without calling an image model. */
export async function renderDesignAsset({ kind, title_lines = [], subtitle = '', color = '#527958', font_style = 'serif', title_effect = 'solid' }) {
  if (!['cover', 'divider'].includes(kind) || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error('设计图类型或颜色无效。');
  if (!Array.isArray(title_lines) || title_lines.length > 3 || title_lines.some(line => typeof line !== 'string' || !line.trim() || [...line].length > 14)
    || (kind === 'cover' && !title_lines.length) || typeof subtitle !== 'string' || [...subtitle].length > 36) throw new Error('题图需1–3行短标题，每行最多14字，副标题最多36字。');
  if (!['serif', 'sans', 'calligraphic', 'contrast'].includes(font_style) || !['solid', 'outline', 'cutout', 'mixed'].includes(title_effect)) throw new Error('字体或艺术字效果无效。');
  const families = { serif: 'Songti SC,SimSun,Noto Serif CJK SC,serif', sans: 'PingFang SC,Microsoft YaHei,Noto Sans CJK SC,sans-serif', calligraphic: 'Kaiti SC,STKaiti,KaiTi,serif' };
  const lettering = title_lines.map((line, i) => {
    const family = families[font_style === 'contrast' ? ['calligraphic', 'sans', 'serif'][i] : font_style];
    const size = Math.min(i === 2 ? 76 : 68, Math.floor(600 / [...line].length));
    const baseline = 260 + i * 104;
    const effect = title_effect === 'mixed' ? ['solid', 'cutout', 'outline'][i] : title_effect;
    const attributes = `x="375" y="${baseline}" text-anchor="middle" font-family="${family}" font-size="${size}" font-weight="600"`;
    if (effect === 'cutout') return `<defs><mask id="letter-${i}"><rect width="750" height="820" fill="white"/><text ${attributes} fill="black">${escape(line)}</text></mask></defs><rect x="56" y="${baseline - 76}" width="638" height="102" rx="2" fill="${color}" mask="url(#letter-${i})"/>`;
    return `<text ${attributes} fill="${effect === 'outline' ? 'none' : '#243e32'}"${effect === 'outline' ? ` stroke="${color}" stroke-width="2.4"` : ''}>${escape(line)}</text>`;
  }).join('');
  const height = kind === 'cover' ? 820 : 104;
  const leaves = `<g fill="${color}" opacity=".64"><path d="M65 48Q105 15 123 62Q91 81 65 48Z"/><path d="M117 82Q156 45 173 88Q139 107 117 82Z"/><path d="M66 98Q34 72 29 118Q52 132 66 98Z"/></g><path d="M24 22Q77 90 191 118" fill="none" stroke="${color}" stroke-width="2" opacity=".45"/>`;
  const ornament = kind === 'cover' ? `
    <rect width="750" height="820" fill="#f4f6ef"/>
    <ellipse cx="610" cy="90" rx="220" ry="160" fill="#e3eddf"/>
    <ellipse cx="75" cy="650" rx="240" ry="190" fill="#e8efdf"/>
    <path d="M0 650Q200 555 410 668T750 640V820H0Z" fill="#dce8da"/>
    <path d="M0 719Q234 660 426 727T750 704V820H0Z" fill="#c4d8cd" opacity=".55"/>
    <path d="M105 706Q338 646 635 699M154 748Q407 703 609 746" fill="none" stroke="white" stroke-width="2" opacity=".8"/>
    <g transform="translate(26 22)">${leaves}</g><g transform="translate(724 800) rotate(180)">${leaves}</g>
    <circle cx="375" cy="133" r="3" fill="${color}"/>
    <path d="M320 133H355M395 133H430" stroke="${color}" opacity=".5"/>
    ${lettering}
    ${subtitle ? `<text x="375" y="${300 + title_lines.length * 100}" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-size="${Math.min(22, Math.floor(620 / [...subtitle].length))}" fill="${color}">${escape(subtitle)}</text>` : ''}`
    : `<path d="M80 52H300M450 52H670" stroke="${color}" opacity=".25"/><g transform="translate(345 15) scale(.4)">${leaves}</g>`;
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="750" height="${height}">${ornament}</svg>`)).png().toBuffer();
}

/** Keep the complete cover title readable in both publishing ratios. */
export async function renderCoverVariants(bytes, title) {
  const lines = [...title].reduce((rows, character, index) => {
    const row = Math.floor(index / 14);
    rows[row] = (rows[row] || '') + character;
    return rows;
  }, []);
  const poster = async height => {
    const size = Math.min(100, Math.floor(880 / Math.min([...title].length, 14)));
    const text = lines.map((line, index) => `<text x="512" y="${height / 2 + (index - (lines.length - 1) / 2) * (size + 16) + size * .35}" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,Noto Sans CJK SC,sans-serif" font-size="${size}" font-weight="700" fill="white">${escape(line)}</text>`).join('');
    const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="${height}"><rect width="1024" height="${height}" fill="black" opacity=".38"/>${text}</svg>`);
    return sharp(bytes, { limitInputPixels: 40_000_000, failOn: 'warning' }).rotate().resize(1024, height, { fit: 'cover' }).composite([{ input: overlay }]).png().toBuffer();
  };
  const [wide, square] = await Promise.all([poster(436), poster(1024)]);
  const combined = await sharp({ create: { width: 1024, height: 1460, channels: 3, background: '#ffffff' } })
    .composite([{ input: wide, top: 0, left: 0 }, { input: square, top: 436, left: 0 }]).png().toBuffer();
  return { wide, square, combined };
}
