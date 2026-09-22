(function () {
  "use strict";

  const cfg = document.getElementById("usageStats");
  if (!cfg) return;

  const NS = cfg.dataset.statNs || "igentrade";
  const VIEWS = cfg.dataset.statViews;
  const TRIES = cfg.dataset.statTries;
  const TRY_FLAG = cfg.dataset.tryFlag || ("igentrade-" + VIEWS + "-try");
  const VIEW_FLAG = cfg.dataset.viewFlag || ("igentrade-" + VIEWS + "-view-session");
  const BASE = "https://tally.yuki.sh/hits";

  if (!VIEWS || !TRIES) return;

  function formatCount(n) {
    const num = Number(n);
    if (!Number.isFinite(num) || num < 0) return "—";
    return new Intl.NumberFormat("ja-JP").format(Math.floor(num));
  }

  function setStatText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = formatCount(value);
  }

  async function fetchStat(resource, { increment } = { increment: false }) {
    const q = increment ? "" : "?mode=read";
    const url = `${BASE}/${NS}/${resource}.json${q}`;
    const res = await fetch(url, { cache: "no-store", keepalive: Boolean(increment) });
    if (!res.ok) throw new Error(`stat ${resource} ${res.status}`);
    const data = await res.json();
    const visitor = Number(data.visitor);
    const visit = Number(data.visit);
    if (Number.isFinite(visitor) && visitor > 0) return visitor;
    if (Number.isFinite(visit)) return visit;
    return 0;
  }

  async function refreshStats({ bumpViews } = { bumpViews: false }) {
    try {
      const views = bumpViews
        ? await fetchStat(VIEWS, { increment: true })
        : await fetchStat(VIEWS, { increment: false });
      setStatText("statViews", views);
    } catch (err) {
      console.warn("view stat failed", err);
    }
    try {
      const tries = await fetchStat(TRIES, { increment: false });
      setStatText("statTries", tries);
    } catch (err) {
      console.warn("try stat failed", err);
    }
  }

  async function recordPageView() {
    let shouldBump = false;
    try {
      if (!sessionStorage.getItem(VIEW_FLAG)) {
        sessionStorage.setItem(VIEW_FLAG, "1");
        shouldBump = true;
      }
    } catch (_) {
      shouldBump = true;
    }
    await refreshStats({ bumpViews: shouldBump });
  }

  async function recordToolTry() {
    try {
      if (localStorage.getItem(TRY_FLAG) === "1") return;
      localStorage.setItem(TRY_FLAG, "1");
    } catch (_) {
      try {
        if (sessionStorage.getItem(TRY_FLAG) === "1") return;
        sessionStorage.setItem(TRY_FLAG, "1");
      } catch (__) {
        /* ignore */
      }
    }
    try {
      const tries = await fetchStat(TRIES, { increment: true });
      setStatText("statTries", tries);
    } catch (err) {
      console.warn("try increment failed", err);
    }
  }

  window.iGenTradeRecordTry = recordToolTry;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", recordPageView);
  } else {
    recordPageView();
  }
})();
