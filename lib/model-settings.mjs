export const defaultSettings = {
  main: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-flash', apiKey: '' },
  vision: { baseUrl: '', model: '', apiKey: '' },
  image: { baseUrl: '', model: '', apiKey: '' },
};
export function publicSettings(config) {
  return Object.fromEntries(Object.entries(config).map(([key, value]) => [key, { baseUrl: value.baseUrl, model: value.model, hasKey: Boolean(value.apiKey), apiKey: '' }]));
}
export function updateSettings(previous, input) {
  const output = {};
  for (const key of ['main', 'vision', 'image']) {
    const value = input[key] ?? {};
    if (value === null || typeof value !== 'object' || Array.isArray(value)
      || ['baseUrl', 'model', 'apiKey'].some(field => value[field] !== undefined && typeof value[field] !== 'string')
      || (value.clearKey !== undefined && typeof value.clearKey !== 'boolean')) throw new Error('模型配置格式无效。');
    const baseUrl = String(value.baseUrl ?? previous[key].baseUrl).trim().replace(/\/+$/, '');
    if (baseUrl) {
      const url = new URL(baseUrl);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('模型地址必须是有效的 HTTP(S) API 基础地址。');
    }
    const model = String(value.model ?? previous[key].model).trim();
    if (model.length > 160) throw new Error('模型名称过长。');
    const apiKey = value.clearKey ? '' : (String(value.apiKey ?? '').trim() || previous[key].apiKey);
    if (apiKey.length > 1000 || /[\r\n]/.test(apiKey)) throw new Error('API 密钥格式无效。');
    output[key] = { baseUrl, model, apiKey };
  }
  return output;
}
