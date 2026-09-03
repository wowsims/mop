// Playwright MCP protocol for the log/timeline pipeline. Run with browser_run_code_unsafe
// against a host serving dist/mop. See tools/browser-perf/README.md.
//
// Wrapped in parentheses so tsc (allowJs) parses it as an expression statement.
async page => {
	page.setDefaultTimeout(180000);

	const URL = process.env.WOWSIMS_URL || 'http://localhost:3333/mop/death_knight/unholy/';

	// Installed once per page: a long-task and mutation recorder plus the counters the
	// pipeline work actually shows up in.
	const OBSERVE = () => {
		window.__m = { long: [], muts: 0, t0: performance.now(), last: performance.now() };
		window.__po = new PerformanceObserver(l => {
			for (const e of l.getEntries()) window.__m.long.push(Math.round(e.duration));
		});
		window.__po.observe({ type: 'longtask' });
		window.__mo = new MutationObserver(ms => {
			window.__m.muts += ms.length;
			window.__m.last = performance.now();
		});
		window.__mo.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
	};

	const COLLECT = () => {
		window.__po.disconnect();
		window.__mo.disconnect();
		// tippy v6 stamps its instance on the reference element, so this counts live
		// instances rather than the handful currently mounted in the DOM.
		const tippies = [...document.querySelectorAll('*')].filter(e => e._tippy).length;
		return {
			sync: Math.round(window.__m.sync ?? 0),
			settle: Math.round(window.__m.last - window.__m.t0),
			muts: window.__m.muts,
			longTasks: window.__m.long,
			nodes: document.querySelectorAll('*').length,
			tippies,
			heapMb: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
		};
	};

	const settle = () => page.waitForFunction(() => performance.now() - window.__m.last > 1500);

	// Runs `action` in the page with the observers armed, waits for the DOM to go quiet,
	// and returns the counters. `action` records its own synchronous cost in __m.sync.
	async function measure(action, arg) {
		await page.evaluate(OBSERVE);
		await page.evaluate(action, arg);
		await settle();
		return page.evaluate(COLLECT);
	}

	const CLICK_RESULTS_TAB = label => {
		const link = [...document.querySelectorAll('.nav-link')].find(a => (a.textContent || '').trim() === label);
		const t = performance.now();
		link.click();
		window.__m.sync = performance.now() - t;
	};

	const out = {};
	await page.goto(URL);
	await page.waitForSelector('.dps-action');
	await page.waitForTimeout(3000);
	// The detailed-results tabs live inside the Results tab; without activating it first the
	// panes stay display:none and anything measuring layout reads zero.
	await page.evaluate(() => [...document.querySelectorAll('.nav-link')].find(a => (a.textContent || '').trim() === 'Results').click());
	await page.waitForTimeout(1000);

	// Pin the RNG seed, then reload so the app picks it up. Without this the rotation
	// differs run to run and row/node counts move by a few percent on their own, which is
	// the same order as some of the changes being measured.
	const seeded = await page.evaluate(() => {
		const key = Object.keys(localStorage).find(k => k.endsWith('__currentSettings__'));
		if (!key) return false;
		const settings = JSON.parse(localStorage.getItem(key));
		settings.settings = { ...settings.settings, fixedRngSeed: '20260903' };
		localStorage.setItem(key, JSON.stringify(settings));
		return true;
	});
	out.seeded = seeded;
	await page.reload();
	await page.waitForSelector('.dps-action');
	await page.waitForTimeout(3000);

	// 1. The cost every Simulate press pays, on a tab that shows neither logs nor timeline.
	//    Repeated, because the headline figure is a long task and one sample says little.
	out.simulateOnDamageTab = [];
	for (let i = 0; i < 3; i++) {
		out.simulateOnDamageTab.push(
			await measure(() => {
				const btn = document.querySelector('.dps-action');
				const t = performance.now();
				btn.click();
				window.__m.sync = performance.now() - t;
			}),
		);
		await page.waitForTimeout(2000);
	}

	// Whether the Timeline tab built itself while hidden. update() sets `rendered` and
	// nothing clears it, so the shown.bs.tab deferral at detailed_results.tsx:275 never
	// fires again — everything below is built into a display:none container.
	out.builtWhileHidden = await page.evaluate(() => {
		const tab = document.querySelector('#timelineTab');
		const scope = sel => (tab ? tab.querySelectorAll(sel).length : -1);
		return {
			timelineTabVisible: tab ? tab.classList.contains('active') : null,
			rotationRows: scope('.rotation-timeline > div'),
			rotationNodes: scope('.rotation-timeline *'),
			timelineTippies: tab ? [...tab.querySelectorAll('*')].filter(e => e._tippy).length : -1,
			logRowsBuilt: document.querySelectorAll('.log-runner-row').length,
		};
	});

	// 2-3. Log tab: first paint, then one search keystroke.
	out.openLogTab = await measure(CLICK_RESULTS_TAB, 'Log');
	out.logRows = await page.evaluate(() => document.querySelectorAll('.log-runner-row').length);

	out.searchKeystroke = await measure(() => {
		const input = document.querySelector('.log-search-input');
		input.value = 'crit';
		const t = performance.now();
		input.dispatchEvent(new Event('input', { bubbles: true }));
		window.__m.sync = performance.now() - t;
	});

	// 4. Scrolling the virtualised list. rAF deltas over ~1s of programmatic scrolling.
	out.scrollLog = await page.evaluate(async () => {
		const el = document.querySelector('.log-runner-scroll');
		const frames = [];
		let last = performance.now();
		let top = 0;
		for (let i = 0; i < 60; i++) {
			top += 400;
			el.scrollTop = top;
			await new Promise(requestAnimationFrame);
			const now = performance.now();
			frames.push(now - last);
			last = now;
		}
		frames.sort((a, b) => a - b);
		return {
			medianFrameMs: Math.round(frames[30]),
			worstFrameMs: Math.round(frames[frames.length - 1]),
			dropped: frames.filter(f => f > 32).length,
		};
	});

	// 5. Timeline tab: this is where the eager tooltip DOM lands.
	out.openTimelineTab = await measure(CLICK_RESULTS_TAB, 'Timeline');
	out.timelineNodes = await page.evaluate(() => ({
		rotationRows: document.querySelectorAll('.rotation-timeline > div').length,
		rotationNodes: document.querySelectorAll('.rotation-timeline *').length,
	}));

	return JSON.stringify(out, null, '\t');
};
