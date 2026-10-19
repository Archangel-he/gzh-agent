import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { load, dump } from 'js-yaml';
import { settings, dataRoot } from '../lib/storage.mjs';
import { receiveGeneratedImage } from '../lib/image-service.mjs';
import { resolveImageConfig, IMAGE_KEY_REF } from '../lib/image-config.mjs';

/**
 * Connectivity check for the image generation service.
 * Resolves the key the same way the app does — this machine's credential store
 * first, data/settings.json as fallback — never prints the API key, and saves
 * one throwaway test picture so the response shape can be verified before use.
 */
async function checkImageService() {
  const config = await settings();
  // Mirror the credential store's managed-file layer (then the launch environment).
  const credentialsFile = path.join(dataRoot, 'desktop-home', '.credentials.yaml');
  let refs = {};
  try { refs = load(await readFile(credentialsFile, 'utf8'))?.refs || {}; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const credentials = { resolve: async ref => { const value = refs[ref] ?? process.env[ref]; return value ? { value } : undefined; } };
  const { baseUrl, model, apiKey, source, configured } = await resolveImageConfig(credentials, config.image || {});
  console.log(`image.baseUrl = ${baseUrl || '(空)'}`);
  console.log(`image.model   = ${model || '(空)'}`);
  console.log(`image.apiKey  = ${apiKey ? `已配置（${apiKey.length} 字符，不显示，来源：${source === 'credential-store' ? '本机凭据库' : 'settings.json'}）` : '(空)'}`);
  if (!configured) {
    console.error('\n配置不完整。请运行 `npm run setup:image` 填入你自己的生图服务地址、模型与密钥后重试。');
    process.exitCode = 1;
    return;
  }
  const url = baseUrl.replace(/\/+$/, '') + '/images/generations';
  console.log(`\nPOST ${url}`);
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, prompt: 'A small flat icon of a green leaf on white background, minimal.', n: 1, size: '1024x1024' }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    console.error(`\n请求失败：${error.message}`);
    console.error('请检查 baseUrl 是否可访问、是否需要代理。');
    process.exitCode = 1;
    return;
  }
  console.log(`HTTP ${response.status} ${response.statusText}`);
  if (!response.ok) {
    const body = (await response.text()).slice(0, 800);
    console.error(`\n服务返回错误：${body}`);
    console.error('常见原因：密钥无效、模型名不对、该模型不支持 images/generations。');
    process.exitCode = 1;
    return;
  }
  const payload = await response.json();
  let generated;
  try {
    generated = await receiveGeneratedImage(payload);
  } catch (error) {
    console.error(`\n图片解析失败：${error.message}`);
    console.error(`响应顶层字段：${JSON.stringify(Object.keys(payload))}，data[0] 字段：${JSON.stringify(Object.keys(payload.data?.[0] || {}))}`);
    process.exitCode = 1;
    return;
  }
  const outDir = path.join(dataRoot, 'image-check');
  await mkdir(outDir, { recursive: true });
  const extension = generated.format === 'jpeg' ? 'jpg' : generated.format;
  const file = path.join(outDir, `test.${extension}`);
  await writeFile(file, generated.bytes);
  console.log(`\n连通性验证通过：收到 ${generated.source === 'url' ? 'URL 型' : 'base64 型'}响应，格式 ${generated.format}，${generated.width} × ${generated.height}，${(generated.bytes.length / 1024).toFixed(1)} KB。`);
  console.log(`测试图片已保存：${file}（仅用于验证，可删除）`);
  console.log('下一步：在 Bloop 里新建对话，即可使用 generate_image 与 generate_cover。');
}

checkImageService().catch(error => { console.error(error.message); process.exitCode = 1; });
