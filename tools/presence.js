(() => {
  'use strict';

  const SUPABASE_URL = 'https://lzmwgsodpvfxtgycvwjy.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_h2qZ1grDZHI71Hw2_6Kydg_UFuIWqVb';
  const script = document.currentScript;
  const tool = script?.dataset.tool || 'overview';
  const toolNames = {
    overview: '工具總覽',
    bond: '債券／基金質借',
    fcn: 'FCN 標的雷達',
    insurance: '保單融資試算',
    etf: 'ETF 技術掃描'
  };
  const toolOrder = ['bond', 'fcn', 'insurance', 'etf'];
  const channelName = 'investment-tools-presence-v1';
  const storageKey = 'investment-tools-presence-visitor';

  const getVisitorId = () => {
    try {
      const existing = sessionStorage.getItem(storageKey);
      if (existing) return existing;
      const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(storageKey, id);
      return id;
    } catch {
      return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  };

  const mount = () => {
    const node = document.createElement('aside');
    node.className = 'live-presence';
    node.setAttribute('aria-live', 'polite');
    node.innerHTML = '<span class="live-presence__pulse"></span><span class="live-presence__copy">正在連線共同研究者…</span>';
    document.body.append(node);
    return node;
  };

  const addStyles = () => {
    const style = document.createElement('style');
    style.textContent = `
      .live-presence{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:9999;display:flex;align-items:flex-start;gap:9px;max-width:min(330px,calc(100vw - 32px));padding:10px 13px;border:1px solid rgba(119,230,177,.32);border-radius:14px;color:#eafff4;background:rgba(13,42,45,.92);box-shadow:0 12px 30px rgba(8,29,33,.24);font:700 13px/1.45 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft JhengHei",sans-serif;backdrop-filter:blur(12px)}
      .live-presence__pulse{width:8px;height:8px;flex:0 0 8px;margin-top:5px;border-radius:50%;background:#55e4ae;box-shadow:0 0 0 4px rgba(85,228,174,.14);animation:live-presence-pulse 1.7s ease-in-out infinite}
      .live-presence__copy{min-width:0}.live-presence__detail{display:block;margin-top:2px;color:#b9decf;font-size:11px;font-weight:600}.live-presence strong{color:#fff}
      @keyframes live-presence-pulse{50%{transform:scale(.76);opacity:.68}} @media (max-width:560px){.live-presence{right:10px;bottom:10px;padding:8px 10px;font-size:12px}.live-presence__detail{font-size:10px}}
    `;
    document.head.append(style);
  };

  const start = async () => {
    addStyles();
    const indicator = mount();
    try {
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const channel = supabase.channel(channelName, {
        config: { presence: { key: getVisitorId() } }
      });

      const render = () => {
        const presences = Object.values(channel.presenceState()).flat();
        const counts = presences.reduce((result, presence) => {
          if (presence?.tool && toolNames[presence.tool]) result[presence.tool] = (result[presence.tool] || 0) + 1;
          return result;
        }, {});
        const currentCount = counts[tool] || 0;
        const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
        const detail = tool === 'overview'
          ? toolOrder.filter((id) => counts[id]).map((id) => `${toolNames[id]} ${counts[id]} 位`).join(' · ')
          : `其中 ${currentCount} 位正在使用${toolNames[tool]}`;
        indicator.innerHTML = `<span class="live-presence__pulse"></span><span class="live-presence__copy"><strong>${total}</strong> 位投資者正在共同研究<span class="live-presence__detail">${detail || '成為第一位加入的研究者'}</span></span>`;
      };

      const publish = () => channel.track({ tool, active: true });
      channel.on('presence', { event: 'sync' }, render).subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await publish();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') publish();
        else channel.untrack();
      });
      window.addEventListener('pagehide', () => channel.untrack());
    } catch {
      indicator.remove();
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
