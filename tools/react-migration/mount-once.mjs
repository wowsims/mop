// StrictMode double-invokes effects, so the shell would be constructed twice without the ref gate
// in app/sim_app.tsx. A second construction is not a crash — it is a second .sim-ui, doubled sidebar
// buttons and doubled subscriptions — so this counts what ended up in the page.
//
// Point REACT_PORT at a DEV SERVER for this one: `node_modules/.bin/vite --port 3403`. Every build
// this app produces embeds React's production bundle (`vite build --mode development` and
// NODE_ENV=development both do), and StrictMode is a no-op there, so against a built page this only
// proves "one shell in the page". Verified by removing the gate: dev server gives .sim-ui=2,
// sidebarButtons=8, tabs=12; a production build gives 1/4/6 either way.
import { launch, openSpec, PORTS, specsFromArgv } from './browser.mjs';

const READ = () => ({
	simUi: document.querySelectorAll('.sim-ui').length,
	simApp: document.querySelectorAll('.sim-app').length,
	rootChildren: document.getElementById('root')?.children.length,
	sidebarActions: document.querySelectorAll('.sim-sidebar-actions .sim-sidebar-action-button').length,
	tabs: document.querySelectorAll('.sim-tabs > li').length,
});

const browser = await launch();
let bad = 0;
for (const spec of specsFromArgv().slice(0, 2)) {
	const { page, errors } = await openSpec(browser, PORTS.react, spec, { settle: 4000 });
	const r = await page.evaluate(READ);
	const ok = r.simUi === 1 && r.simApp === 1 && r.rootChildren === 1 && errors.length === 0;
	if (!ok) bad++;
	console.log(
		`${ok ? 'PASS' : 'FAIL'}  ${spec.padEnd(20)} .sim-ui=${r.simUi} .sim-app=${r.simApp} #root children=${r.rootChildren} sidebarButtons=${r.sidebarActions} tabs=${r.tabs} errors=${errors.length}`,
	);
	if (errors.length) console.log('   ', errors.slice(0, 2));
	await page.close();
}
await browser.close();
console.log(bad ? `\n${bad} FAILED` : '\nconstruct-once holds under StrictMode');
process.exit(bad ? 1 : 0);
