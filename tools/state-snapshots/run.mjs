// Node runner: registers a happy-dom environment, then imports the bundled
// harness entry (built by `vite build -c vite.harness.mts`).
import { GlobalRegistrator } from '@happy-dom/global-registrator';

process.on('unhandledRejection', err => {
	// Database.get() fetches assets that don't resolve in node; snapshots don't need them.
	console.error('[harness] ignored unhandled rejection:', err?.message ?? err);
});

GlobalRegistrator.register({ url: 'https://wowsims.github.io/mop/' });

// Serve /mop/assets/** from the local checkout instead of the network.
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const origFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
	const url = String(input?.url ?? input);
	const m = url.match(/\/mop\/(assets\/.*)$/);
	if (m) {
		const buf = await readFile(path.join(repoRoot, m[1]));
		return new Response(buf, { status: 200 });
	}
	return origFetch(input, init);
};

// Sim's constructor spawns web workers; happy-dom has no Worker.
globalThis.Worker = class Worker {
	constructor() {}
	postMessage() {}
	addEventListener() {}
	removeEventListener() {}
	terminate() {}
};

const mod = await import('../../tmp/harness/' + (process.env.HARNESS_BUNDLE ?? 'snapshot.js'));
await mod.main();
// No GlobalRegistrator.unregister(): tearing down happy-dom with the sim's
// dangling timers/promises throws noisy async errors. Exit instead — but only
// after stdout has drained, or piped output gets truncated.
await new Promise(resolve => process.stdout.write('', resolve));
process.exit(0);
