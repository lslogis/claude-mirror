// Claude Mirror — Analytics Worker
// 모든 요청의 방문자 정보를 로그로 기록
// Cloudflare Observability로 자동 수집됨

// 알려진 AI 봇 목록
const AI_BOTS = {
  'GPTBot': 'OpenAI',
  'ChatGPT-User': 'OpenAI',
  'Google-Extended': 'Google',
  'Googlebot': 'Google',
  'Bingbot': 'Microsoft',
  'ClaudeBot': 'Anthropic',
  'Claude-Web': 'Anthropic',
  'Applebot-Extended': 'Apple',
  'CCBot': 'Common Crawl',
  'FacebookBot': 'Meta',
  'Bytespider': 'ByteDance',
  'Amazonbot': 'Amazon',
  'PerplexityBot': 'Perplexity',
  'YouBot': 'You.com',
  'Cohere-ai': 'Cohere',
};

function detectBot(ua) {
  if (!ua) return null;
  for (const [pattern, org] of Object.entries(AI_BOTS)) {
    if (ua.includes(pattern)) return { bot: pattern, org };
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ua = request.headers.get('user-agent') || '';
    const bot = detectBot(ua);

    // 구조화된 로그 — Cloudflare Observability에서 쿼리 가능
    console.log(JSON.stringify({
      type: 'visit',
      path: url.pathname,
      method: request.method,
      ua: ua.slice(0, 200),
      bot: bot ? bot.bot : null,
      botOrg: bot ? bot.org : null,
      country: request.cf?.country || null,
      city: request.cf?.city || null,
      ts: new Date().toISOString(),
    }));

    // assets로 패스스루 (env.ASSETS는 Cloudflare가 자동 제공)
    return env.ASSETS.fetch(request);
  }
};
