const $ = selector => document.querySelector(selector);
let config, selectedTheme = 'editorial', uploads = [], currentId = null, displayedId = null, previousId = null, busy = false, polling = null;
const statusNames = { queued: '排队中', running: '正在设计', completed: '已完成', failed: '需处理', cancelled: '已停止' };
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 6500); }
async function api(url, options) {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '操作未完成。');
  return result;
}
const post = (url, value) => api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
function theme(value) { selectedTheme = value; document.querySelectorAll('.theme').forEach(button => button.classList.toggle('selected', button.dataset.theme === value)); }
function count() { $('#charCount').textContent = `${$('#source').value.length.toLocaleString()} / 16,000`; }
function setBusy(value) {
  busy = value;
  $('#generateBtn').disabled = value;
  $('#generateBtn').innerHTML = value ? '正在设计…' : '开始设计 <span>↗</span>';
  $('#cancelBtn').hidden = !value;
  $('#newProject').disabled = value;
}
function setRevision(id) { previousId = id; $('#revision').hidden = !id; }
function reset() {
  if (busy) return;
  clearTimeout(polling); currentId = null; displayedId = null; setRevision(null); uploads = []; renderImages();
  $('#source').value = ''; $('#instruction').value = ''; count();
  $('#projectName').textContent = '新建文章'; $('#preview').hidden = true; $('#emptyPreview').hidden = false;
  $('#copyBtn').disabled = true; $('#downloadBtn').classList.add('disabled'); $('#downloadBtn').setAttribute('aria-disabled', 'true');
  $('#stateBadge').textContent = '等待内容'; $('#stateBadge').className = 'state-badge';
  $('#resultNotes').hidden = true; $('#activity').replaceChildren();
  const li = document.createElement('li'); li.textContent = '每一步，都在这里看得见。'; li.className = 'idle'; $('#activity').append(li);
}
async function loadSettings() {
  const result = await api('/api/settings'); config = result.config;
  $('#configDot').classList.toggle('ready', config.main.hasKey);
  $('#imageApiDot').classList.toggle('ready', config.image.hasKey && config.image.baseUrl && config.image.model);
  $('#imageHint').textContent = config.image.hasKey && config.image.baseUrl && config.image.model ? '生图服务已配置 · 按需调用' : '需要单独配置生图服务';
}
function showSettings() {
  const host = $('#providerFields'); host.replaceChildren();
  for (const [key, title, hint] of [['main', '主 Agent', '文章理解与排版'], ['vision', '视觉子 Agent', '留空时使用主模型'], ['image', '生图服务', '可选 · 需要独立的生图接口']]) {
    const card = document.createElement('div'); card.className = 'provider-card'; card.dataset.provider = key;
    const heading = document.createElement('h3'); heading.textContent = title;
    const info = document.createElement('span'); info.textContent = hint; heading.append(info); card.append(heading);
    for (const [name, label, placeholder] of [['baseUrl', 'API 基础地址', key === 'main' ? 'https://api.deepseek.com/v1' : 'https://你的服务商/v1'], ['model', '模型名称', key === 'main' ? 'deepseek-flash' : '按服务商提供的名称填写'], ['apiKey', 'API 密钥', config[key].hasKey ? '已保存，留空保留现有密钥' : '填写密钥']]) {
      const field = document.createElement('label'); field.textContent = label;
      const input = document.createElement('input'); input.name = name; input.type = name === 'apiKey' ? 'password' : 'text'; input.autocomplete = 'off'; input.placeholder = placeholder; input.value = name === 'apiKey' ? '' : config[key][name]; field.append(input); card.append(field);
    }
    if (config[key].hasKey) { const field = document.createElement('label'), input = document.createElement('input'); input.type = 'checkbox'; input.name = 'clearKey'; input.style.cssText = 'display:inline;width:auto;margin-right:8px'; field.append(input, document.createTextNode('清除此服务已保存的密钥')); card.append(field); }
    host.append(card);
  }
  $('#settingsDialog').showModal();
}
$('#settingsForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter; button.disabled = true;
  try {
    const value = {};
    for (const card of document.querySelectorAll('.provider-card')) value[card.dataset.provider] = { baseUrl: card.querySelector('[name=baseUrl]').value, model: card.querySelector('[name=model]').value, apiKey: card.querySelector('[name=apiKey]').value, clearKey: Boolean(card.querySelector('[name=clearKey]')?.checked) };
    await post('/api/settings', value); await loadSettings(); $('#settingsDialog').close(); toast('模型设置已保存在本地。');
  } catch (error) { toast(error.message); } finally { button.disabled = false; }
});
$('#settingsBtn').onclick = showSettings;
$('#closeSettings').onclick = () => $('#settingsDialog').close();
function showImageApi() {
  const card = $('#imageApiDialog .provider-card');
  card.querySelector('[name=baseUrl]').value = config.image.baseUrl || '';
  card.querySelector('[name=model]').value = config.image.model || '';
  card.querySelector('[name=apiKey]').value = '';
  card.querySelector('[name=apiKey]').placeholder = config.image.hasKey ? '已保存，留空保留现有密钥' : '填写密钥';
  const clear = card.querySelector('[name=clearKey]'); clear.checked = false;
  $('#imageApiClearWrap').hidden = !config.image.hasKey;
  $('#imageApiDialog').showModal();
}
$('#imageApiBtn').onclick = showImageApi;
$('#closeImageApi').onclick = () => $('#imageApiDialog').close();
$('#imageApiForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter; button.disabled = true;
  try {
    const card = $('#imageApiDialog .provider-card');
    await post('/api/settings', { image: { baseUrl: card.querySelector('[name=baseUrl]').value, model: card.querySelector('[name=model]').value, apiKey: card.querySelector('[name=apiKey]').value, clearKey: Boolean(card.querySelector('[name=clearKey]').checked) } });
    await loadSettings(); $('#imageApiDialog').close(); toast('生图配置已保存在本机。');
  } catch (error) { toast(error.message); } finally { button.disabled = false; }
});
$('#newProject').onclick = reset;
$('#source').addEventListener('input', count);
$('#clearRevision').onclick = () => setRevision(null);
document.querySelectorAll('.theme').forEach(button => { button.onclick = () => theme(button.dataset.theme); });
$('#sampleBtn').onclick = () => {
  if (busy) return;
  reset();
  $('#source').value = '周末，把灵感变成作品\n\n我们准备了一场面向初学者的创意工作坊。你可以带上一段文字、几张照片，或一个还没有成形的想法，和大家一起把它做成能分享的作品。\n\n活动时间：2026 年 10 月 24 日 14:00—17:00。\n活动地点：城市创意空间二楼。\n\n第一小时，我们会从生活里的观察开始，找到值得讲述的故事。随后分组完成设计，在最后半小时分享彼此的成果。\n\n不需要设计基础，也不需要准备完整方案。带着好奇心来，带着一件小作品回家。';
  $('#instruction').value = '做成有呼吸感的活动介绍。保留所有原文，把时间和地点整理为醒目的信息区，整体像一本安静的杂志。'; count();
};
async function addImages(files) {
  try {
    if (uploads.length + files.length > 6) throw new Error('最多添加六张图片。');
    const additions = [];
    for (const file of files) {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('请使用 5 MB 以内的 PNG、JPG 或 WebP。');
      const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      additions.push({ name: file.name, dataUrl, role: 'article' });
    }
    uploads.push(...additions); renderImages();
  } catch (error) { toast(error.message); }
  $('#images').value = '';
}
function renderImages() {
  $('#imageList').replaceChildren();
  uploads.forEach((image, index) => {
    const card = document.createElement('div'); card.className = 'image-card';
    const img = document.createElement('img'); img.src = image.dataUrl; img.alt = image.name;
    const select = document.createElement('select'); select.setAttribute('aria-label', `${image.name}的用途`);
    for (const [value, label] of [['article', '文章配图'], ['reference', '参考风格'], ['document', '文字资料']]) { const option = document.createElement('option'); option.value = value; option.textContent = label; select.append(option); }
    select.value = image.role; select.onchange = () => { image.role = select.value; };
    const remove = document.createElement('button'); remove.textContent = '×'; remove.setAttribute('aria-label', `移除${image.name}`); remove.onclick = () => { uploads.splice(index, 1); renderImages(); };
    card.append(img, select, remove); $('#imageList').append(card);
  });
}
$('#images').onchange = event => { void addImages([...event.target.files]); };
for (const event of ['dragover', 'dragleave', 'drop']) $('#dropZone').addEventListener(event, e => { e.preventDefault(); $('#dropZone').classList.toggle('drag', event === 'dragover'); if (event === 'drop') void addImages([...e.dataTransfer.files]); });
async function history() {
  const jobs = await api('/api/projects'); $('#historyCount').textContent = jobs.length; $('#history').replaceChildren();
  for (const job of jobs) { const button = document.createElement('button'); button.textContent = `${job.status === 'completed' ? '◉' : '○'}  ${job.title}`; button.title = `${job.title} · ${statusNames[job.status]}`; button.onclick = () => { if (!busy || currentId === job.id) void loadJob(job.id, true); else toast('请先等待当前任务完成或停止任务。'); }; $('#history').append(button); }
}
async function loadJob(id, hydrate = false) {
  clearTimeout(polling);
  const job = await api('/api/projects/' + id);
  currentId = id;
  if (hydrate) { $('#source').value = job.text; $('#instruction').value = job.instruction; $('#mode').value = job.mode; theme(job.theme); uploads = []; renderImages(); count(); }
  $('#projectName').textContent = job.title || '正在设计的文章';
  $('#stateBadge').textContent = statusNames[job.status]; $('#stateBadge').className = 'state-badge ' + job.status;
  $('#engineLabel').textContent = job.mode === 'demo' ? '本地体验 · 未调用 AI' : 'DeepSeek Harness';
  $('#activity').replaceChildren();
  for (const item of job.events) { const li = document.createElement('li'); li.textContent = item.message; $('#activity').append(li); }
  if (!job.events.length) { const li = document.createElement('li'); li.textContent = '任务已创建，正在准备…'; $('#activity').append(li); }
  setBusy(['queued', 'running'].includes(job.status));
  if (busy) { $('#resultNotes').hidden = true; polling = setTimeout(() => { if (currentId === id) void loadJob(id).catch(error => { setBusy(false); toast(error.message); }); }, 1400); }
  if (job.status === 'completed') {
    displayedId = id;
    const src = `/files/${id}/article.html`;
    if ($('#preview').getAttribute('src') !== src) $('#preview').src = src;
    $('#preview').hidden = false; $('#emptyPreview').hidden = true;
    $('#downloadBtn').href = `/api/projects/${id}/export`; $('#downloadBtn').classList.remove('disabled'); $('#downloadBtn').setAttribute('aria-disabled', 'false'); $('#copyBtn').disabled = false;
    $('#resultNotes').textContent = [job.notes, ...(job.warnings || []).map(x => '提示：' + x)].filter(Boolean).join('\n'); $('#resultNotes').hidden = false;
    setRevision(id); await history();
  } else if (['failed', 'cancelled'].includes(job.status)) {
    $('#resultNotes').textContent = job.error + (displayedId ? '\n预览仍保留上一个成功版本。' : ''); $('#resultNotes').hidden = false; await history();
  }
}
$('#generateBtn').onclick = async () => {
  if (busy) return;
  setBusy(true);
  try {
    const result = await post('/api/projects', { text: $('#source').value, instruction: $('#instruction').value, images: uploads, theme: selectedTheme, generateImages: $('#generateImages').checked, mode: $('#mode').value, previousId });
    currentId = result.id; uploads = []; renderImages(); await history(); await loadJob(result.id);
  } catch (error) { setBusy(false); toast(error.message); }
};
$('#cancelBtn').onclick = async () => { try { if (currentId) { await post(`/api/projects/${currentId}/cancel`, {}); toast('已请求停止，正在等待任务释放资源。'); } } catch (error) { toast(error.message); } };
$('#mobileBtn').onclick = () => { const mobile = $('#preview').classList.toggle('mobile'); $('#mobileBtn').setAttribute('aria-pressed', String(mobile)); };
$('#copyBtn').onclick = async () => {
  try {
    const response = await fetch(`/files/${displayedId}/article.html`); if (!response.ok) throw new Error('正文读取失败。');
    const html = (await response.text()).replaceAll('src="assets/', `src="${location.origin}/files/${displayedId}/assets/`);
    const plain = new DOMParser().parseFromString(html, 'text/html').body.textContent;
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })]);
    toast('已复制正文。图片请在公众号后台检查并按需重新上传。');
  } catch (error) { toast('自动复制未完成。可在预览中选中文章后按 ⌘C / Ctrl+C。'); }
};
try { await loadSettings(); await history(); } catch (error) { toast(error.message); }
