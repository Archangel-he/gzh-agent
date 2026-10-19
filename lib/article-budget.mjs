export const ARTICLE_LIMITS = Object.freeze({ searches: 2, pages: 6, candidates: 12, materialMs: 90_000, toolMs: 15_000, imageReads: 8, reviewImages: 2, reviewShells: 2, calls: 32 });

export function createArticleBudget() {
  return { active: false, submitted: false, materialStarted: null, candidates: 0, calls: 0, searches: 0, pages: 0, imageReads: 0, reviewImages: 0, reviewShells: 0 };
}

export function materialTimeLeft(budget) {
  budget.materialStarted ??= Date.now();
  return Math.max(0, ARTICLE_LIMITS.materialMs - (Date.now() - budget.materialStarted));
}

/** Per-turn work limits; file sandbox and approval remain owned by Harness. */
export function registerArticleBudget(ctx, budget, rootId) {
  ctx.on('tools/pre-execute', async (exec, next) => {
    if (rootId && exec.agent?.session.id !== rootId) return next();
    if (exec.name.startsWith('gzh_')) budget.active = true;
    if (!budget.active || ['present', 'submit_article', 'ask_user_question'].includes(exec.name)) return next();
    const deny = reason => ({ kind: 'deny', reason });
    if (++budget.calls > ARTICLE_LIMITS.calls) return deny('本轮文章工具预算已用尽。交付上次成功的文件并说明限制，不再尝试新工具；没有成功文件时说明未完成。');
    const key = { web_search: 'searches', web_fetch: 'pages', read_image: 'imageReads' }[exec.name];
    if (key && budget[key] >= ARTICLE_LIMITS[key]) return deny('本轮搜索、网页或看图次数已用尽。使用已取得的素材，停止继续搜集和检查。');
    if (key) budget[key]++;
    if (['web_search', 'web_fetch', 'gzh_download_images'].includes(exec.name) && materialTimeLeft(budget) <= 0) return deny('本轮素材获取的90秒预算已用尽。使用已取得的素材，并说明缺少的部分，不继续换方式下载。');
    if (['bash', 'pwsh'].includes(exec.name) && /\b(curl|wget)\b|urllib\.request|requests\s*\.|\bfetch\s*\(|Invoke-WebRequest|Invoke-RestMethod|Start-BitsTransfer|WebClient|\b(iwr|irm)\b/i.test(String(exec.arguments?.command))) return deny('公众号图片下载请使用 gzh_download_images；不要通过 Shell 绕过下载预算。网页检索使用 web_search / web_fetch。');
    if (budget.submitted && ['read_image', 'bash', 'pwsh'].includes(exec.name)) {
      const review = exec.name === 'read_image' ? 'reviewImages' : 'reviewShells';
      if (budget[review] >= ARTICLE_LIMITS[review]) return deny('本轮视觉检查预算已用尽。最多一次整页检查及一轮合并修复；现在 submit_article（如已修复）并 present，说明剩余可见问题。');
      budget[review]++;
    }
    return next();
  });
  ctx.on('tools/execute', async (exec, next) => {
    if (rootId && exec.agent?.session.id !== rootId) return next();
    if (!budget.active || !['bash', 'pwsh', 'job_output', 'web_fetch', 'web_search'].includes(exec.name)) return next();
    const upstream = exec.signal;
    const controller = new AbortController();
    const ms = Math.min(ARTICLE_LIMITS.toolMs, exec.name.startsWith('web_') ? materialTimeLeft(budget) : ARTICLE_LIMITS.toolMs);
    const timer = setTimeout(() => controller.abort(new Error('文章工具执行超时，请使用现有结果并结束本轮，不重复等待。')), ms);
    exec.signal = AbortSignal.any([upstream, controller.signal]);
    try {
      const result = await next();
      if (controller.signal.aborted && !upstream.aborted) return { content: [{ type: 'text', text: '文章工具已达到15秒或剩余素材时间上限；不要原样重试。' }], isError: true };
      return result;
    } catch (error) {
      if (controller.signal.aborted && !upstream.aborted) return { content: [{ type: 'text', text: '文章工具已超时并取消，请使用已有结果，不原样重试。' }], isError: true };
      throw error;
    } finally { clearTimeout(timer); exec.signal = upstream; }
  });
}
