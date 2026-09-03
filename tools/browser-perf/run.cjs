// Standalone runner for the protocol scripts in this directory.
//
//   node tools/browser-perf/run.cjs log-pipeline-timing.js [port]
//
// The Playwright MCP holds a single browser profile, so it refuses to start a second
// instance while another Claude session owns it ("Browser is already in use"). This runner
// drives the same protocol files over the npx-cached playwright-core instead, and takes a
// port so master and a branch can be timed back to back from two dist/ checkouts.

const fs = require('fs');
const os = require('os');
const path = require('path');

const [, , protocolArg, portArg] = process.argv;
if (!protocolArg) {
	console.error('usage: node tools/browser-perf/run.cjs <protocol.js> [port]');
	process.exit(1);
}

function findModule(name) {
	try {
		return require(name);
	} catch {}
	const roots = [path.join(os.homedir(), '.npm/_npx')];
	for (const root of roots) {
		for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
			const candidate = path.join(root, entry.name, 'node_modules', name);
			if (fs.existsSync(candidate)) return require(candidate);
		}
	}
	throw new Error(`could not resolve ${name}; run "npx playwright-core --version" once to populate the npx cache`);
}

function findChromium() {
	if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
	const base = path.join(os.homedir(), '.cache/ms-playwright');
	const builds = fs
		.readdirSync(base)
		.filter(d => d.startsWith('chromium-'))
		.sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
	for (const build of builds) {
		const exe = path.join(base, build, 'chrome-linux64', 'chrome');
		if (fs.existsSync(exe)) return exe;
	}
	throw new Error('no chromium build found under ~/.cache/ms-playwright');
}

(async () => {
	const { chromium } = findModule('playwright-core');
	const protocolPath = path.resolve(__dirname, protocolArg);
	let source = fs.readFileSync(protocolPath, 'utf8');
	if (portArg) source = source.replace(/localhost:3333/g, `localhost:${portArg}`);

	const browser = await chromium.launch({ executablePath: findChromium(), headless: true, args: ['--no-sandbox'] });
	try {
		const page = await browser.newPage();
		page.on('console', msg => {
			if (msg.type() === 'error') console.error('[page error]', msg.text());
		});
		// eslint-disable-next-line no-eval
		const protocol = eval(source);
		console.log(await protocol(page));
	} finally {
		await browser.close();
	}
})().catch(err => {
	console.error(err);
	process.exit(1);
});
