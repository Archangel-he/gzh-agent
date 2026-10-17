/** Provider settings shared by the launcher and article runtime; no native dependencies. */
export function route(config, envKey, vision = false) {
  return {
    api: 'openai-completions', baseURL: config.baseUrl, apiKeyEnv: envKey,
    compat: { thinkingFormat: 'deepseek' },
    retryPolicy: { mode: 'normal', maxRetries: 1 },
    models: [{ id: config.model, name: config.model, contextWindow: 131072, maxTokens: 16384, input: vision ? ['text', 'image'] : ['text'] }],
  };
}
