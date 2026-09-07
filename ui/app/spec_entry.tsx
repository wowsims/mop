// Generic page entry for every spec site. A spec page is `/mop/<class>/<spec>/`, which mirrors the folder tree (vite's root is `ui/`), so the module to load is derivable from the URL — no per-spec `index.ts`.
import { browserEnv } from '@app/browser_env';
import { Player } from '@sim/player';
import { PlayerSpecs } from '@sim/player_specs';
import { Sim } from '@sim/sim';
import type { SpecDefinition } from '@sim/spec_config';
import { registerSpecConfig } from '@sim/spec_config';
import { StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { SimApp } from './SimApp';

const modules = import.meta.glob<{ default: SpecDefinition<any> }>('../specs/*/*/spec.{ts,tsx}');

// '/mop/warrior/arms/' -> '../specs/warrior/arms/spec' (then tried as .ts and .tsx —
// a couple of specs need real JSX for their reforge tooltips).
const specModuleKey = (pathname: string): string => {
	const base = import.meta.env.BASE_URL || '/';
	const rel = (pathname.startsWith(base) ? pathname.slice(base.length) : pathname)
		.replace(/^\/+/, '')
		.replace(/index\.html$/, '')
		.replace(/\/+$/, '');
	return `../specs/${rel}/spec`;
};

// An async IIFE rather than top-level await: the vite build target does not
// support TLA and downgrades it to a tolerated transform.
// An async IIFE rather than top-level await: the vite build target does not support TLA and downgrades it to a tolerated transform.
void (async () => {
	const key = specModuleKey(location.pathname);
	const loadSpec = modules[`${key}.ts`] || modules[`${key}.tsx`];
	if (!loadSpec) {
		throw new Error(`No spec module for ${location.pathname} (looked for ${key}.ts(x)).`);
	}

	const def = (await loadSpec()).default;

	// `new Player()` resolves the spec's config out of the registry in its constructor, so the definition has to be registered before the player is built.

	registerSpecConfig(def.spec, def);

	const sim = new Sim({ env: browserEnv });
	// A run flag written from a vanilla click handler has to reach React in that same task:
	// `sidebar-loading.mjs` reads the spinner back before the handler returns.
	sim.runs.setFlush(flushSync);
	const playerSpec = PlayerSpecs.fromProto(def.spec);
	const player = new Player(playerSpec, sim);
	if (def.enableHealing ?? (playerSpec.isTankSpec || playerSpec.isHealingSpec)) player.enableHealing();

	sim.raid.setPlayer(0, player);

	const rootElem = document.getElementById('root');
	if (!rootElem) throw new Error('No #root element on the page; ui/index_template.html should provide it.');

	createRoot(rootElem).render(
		<StrictMode>
			<SimApp player={player} def={def} />
		</StrictMode>,
	);
})();
