// Wrapped in parentheses so tsc (allowJs) parses it as an expression statement.
// Add a second [name, url] pair to A/B against another checkout.
// The gear selector on warrior/arms main hand, the largest item pool in the tree. Phase A opens and
// closes the modal five times with one favourite toggle inside each; phase B measures search, a tab
// switch and a scroll inside one open. See README.md for what to read and what to ignore.
(async (page) => {
  page.setDefaultTimeout(120000);
  // Main Hand. .gear-picker-left renders Head Neck Shoulder Back Chest Wrist MainHand OffHand.
  const SLOT_INDEX = 6;
  const SEARCH = 'blad';
  const QUIET = 1500;
  const out = {};

  for (const [name, url] of [['this-branch', 'http://localhost:3333/mop/warrior/arms/']]) {
    await page.goto(url);
    await page.waitForSelector('#gear-tab .gear-picker-left .item-picker-root');
    await page.waitForFunction(() => document.querySelectorAll('#gear-tab .item-picker-root').length >= 16);
    await page.waitForTimeout(3000);

    await page.evaluate(() => {
      const activePane = () => document.querySelector('.selector-modal-tab-pane.active');
      window.__pf = {
        activePane,
        start(rowSelector) {
          const m = { long: [], muts: 0, modalMuts: 0, t0: performance.now(), last: performance.now(), firstRow: null, sync: null };
          window.__m = m;
          window.__po = new PerformanceObserver(l => { for (const e of l.getEntries()) m.long.push(Math.round(e.duration)); });
          window.__po.observe({ type: 'longtask' });
          window.__mo = new MutationObserver(records => {
            m.muts += records.length;
            // `muts` is the whole page: the sim's React shell re-renders off the same store writes
            // the selector does. `modalMuts` is the selector's own share, which is what the rebuild
            // is judged on.
            for (const r of records) {
              const el = r.target.nodeType === 1 ? r.target : r.target.parentElement;
              if (el && el.closest('.selector-modal')) m.modalMuts++;
            }
            m.last = performance.now();
            if (m.firstRow === null && rowSelector) {
              for (const r of records) for (const n of r.addedNodes) {
                if (n.nodeType === 1 && n.matches && n.matches(rowSelector)) { m.firstRow = Math.round(performance.now() - m.t0); return; }
              }
            }
          });
          window.__mo.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
        },
        run(fn) {
          const t = performance.now();
          fn();
          window.__m.sync = Math.round(performance.now() - t);
        },
        stop() {
          window.__po.disconnect();
          window.__mo.disconnect();
          const m = window.__m;
          return { sync: m.sync, firstRow: m.firstRow, settle: Math.round(m.last - m.t0), muts: m.muts, modalMuts: m.modalMuts, longTasks: m.long };
        },
        counts() {
          const pane = activePane();
          const list = pane && pane.querySelector('.selector-modal-list');
          const rows = pane ? pane.querySelectorAll('.selector-modal-list-item') : [];
          const rowHeight = rows.length ? Math.round(rows[0].getBoundingClientRect().height) : 0;
          return {
            tabs: document.querySelectorAll('.selector-modal-tabs .selector-modal-item-tab').length,
            rowsMounted: rows.length,
            rowHeight,
            pool: list && rowHeight ? Math.round(list.scrollHeight / rowHeight) : 0,
            nodes: pane ? pane.querySelectorAll('*').length : 0,
          };
        },
        // Through the prototype setter so the same protocol drives a React-controlled input later.
        setValue(el, value) {
          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, value);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        },
      };
    });

    const measure = async (rowSelector, body, arg) => {
      await page.evaluate(sel => window.__pf.start(sel), rowSelector);
      await page.evaluate(body, arg);
      await page.waitForFunction(q => performance.now() - window.__m.last > q, QUIET);
      return page.evaluate(() => Object.assign(window.__pf.stop(), window.__pf.counts()));
    };
    const openModal = () => measure('li.selector-modal-list-item', i => {
      const icon = document.querySelectorAll('#gear-tab .gear-picker-left .item-picker-root')[i].querySelector('.item-picker-icon');
      window.__pf.run(() => icon.click());
    }, SLOT_INDEX);
    const closeModal = async () => {
      await page.evaluate(() => document.querySelector('.selector-modal .btn-close').click());
      await page.waitForTimeout(500);
    };

    // Phase A — five open/close cycles. Each measures the open, then one favourite toggle.
    const opens = [];
    const favourites = [];
    for (let i = 0; i < 5; i++) {
      opens.push(await openModal());
      favourites.push(await measure(null, () => {
        const btn = window.__pf.activePane().querySelector('.selector-modal-list-item .selector-modal-list-item-favorite');
        window.__pf.run(() => btn.click());
      }));
      // Un-favourite again, so the run leaves the persisted sim filters as it found them.
      await page.evaluate(() => {
        const row = window.__pf.activePane().querySelector('.selector-modal-list-item[data-fav="true"]');
        if (row) row.querySelector('.selector-modal-list-item-favorite').click();
      });
      await page.waitForTimeout(500);
      await closeModal();
    }

    // Phase B — one more open, then the three interactions inside it.
    const reopen = await openModal();
    const search = [];
    for (let i = 1; i <= SEARCH.length; i++) {
      search.push(await measure(null, chars => {
        const input = window.__pf.activePane().querySelector('.selector-modal-search');
        window.__pf.run(() => window.__pf.setValue(input, chars));
      }, SEARCH.slice(0, i)));
    }
    await page.evaluate(() => {
      const input = window.__pf.activePane().querySelector('.selector-modal-search');
      window.__pf.setValue(input, '');
    });
    await page.waitForTimeout(800);
    const tabSwitch = await measure(null, () => {
      const tab = document.querySelector('.selector-modal-tabs .selector-modal-item-tab[data-label="Enchants"]');
      window.__pf.run(() => tab.click());
    });
    await page.evaluate(() => document.querySelector('.selector-modal-tabs .selector-modal-item-tab[data-label="Items"]').click());
    await page.waitForTimeout(800);
    // Ten viewports, 120 ms apart, so the scroll handler runs ten times rather than coalescing into
    // one. `sync` is the first step only; `muts` and `peakRows` cover the whole traversal.
    const scroll = await measure(null, async () => {
      const list = window.__pf.activePane().querySelector('.selector-modal-list');
      let peak = 0;
      for (let step = 1; step <= 10; step++) {
        const scrollTo = () => { list.scrollTop = step * list.clientHeight; };
        if (step === 1) window.__pf.run(scrollTo);
        else scrollTo();
        await new Promise(r => setTimeout(r, 120));
        peak = Math.max(peak, window.__pf.activePane().querySelectorAll('.selector-modal-list-item').length);
      }
      window.__m.peakRows = peak;
    });
    scroll.peakRows = await page.evaluate(() => window.__m.peakRows);
    await closeModal();

    out[name] = { opens, favourites, reopen, search, tabSwitch, scroll };
  }
  return JSON.stringify(out);
})
