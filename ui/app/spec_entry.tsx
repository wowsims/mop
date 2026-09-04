// Generic page entry for every spec site.
//
// A spec page is `/mop/<class>/<spec>/`, which mirrors the folder tree (vite's
// root is `ui/`), so the module to load is derivable from the URL — no
// per-spec `index.ts`. The glob is lazy, so each `spec.ts` (and the presets it
// pulls in) lands in its own chunk and only the visited spec is fetched.
import { browserEnv } from '@app/browser_env';
import { Player } from '@domain/player';
import { PlayerSpecs } from '@domain/player_specs';
import { Sim } from '@domain/sim';
import type { SpecDefinition } from '@features/spec_config';
import { registerSpecConfig } from '@features/spec_config';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { SimApp } from './sim_app';

const modules = import.meta.glob<{ default: SpecDefinition<any> }>('../sims/*/*/spec.{ts,tsx}');

// '/mop/warrior/arms/' -> '../sims/warrior/arms/spec' (then tried as .ts and .tsx —
// a couple of specs need real JSX for their reforge tooltips).
function specModuleKey(pathname: string): string {
	const base = import.meta.env.BASE_URL || '/';
	const rel = (pathname.startsWith(base) ? pathname.slice(base.length) : pathname)
		.replace(/^\/+/, '')
		.replace(/index\.html$/, '')
		.replace(/\/+$/, '');
	return `../sims/${rel}/spec`;
}

// An async IIFE rather than top-level await: the vite build target does not
// support TLA and downgrades it to a tolerated transform.
void (async () => {
	const key = specModuleKey(location.pathname);
	const loadSpec = modules[`${key}.ts`] || modules[`${key}.tsx`];
	if (!loadSpec) {
		throw new Error(`No spec module for ${location.pathname} (looked for ${key}.ts(x)).`);
	}

	const def = (await loadSpec()).default;

	// Ordering constraint, documented here once: `new Player()` resolves the
	// spec's config out of the registry in its constructor, so the definition has
	// to be registered before the player is built.
	registerSpecConfig(def.spec, def);

	const sim = new Sim({ env: browserEnv });
	const playerSpec = PlayerSpecs.fromProto(def.spec);
	const player = new Player(playerSpec, sim);
	// Tanks and healers sim their own healing output. That follows from the spec
	// itself, so it is derived from the registry rather than restated per spec;
	// `enableHealing` on the definition is the override for the exceptions.
	if (def.enableHealing ?? (playerSpec.isTankSpec || playerSpec.isHealingSpec)) player.enableHealing();

	sim.raid.setPlayer(0, player);

	// React owns the page root from here. Sim and Player are still built imperatively above, because
	// `registerSpecConfig` must run before `new Player()` and neither belongs to a render pass.
	const rootElem = document.getElementById('root');
	if (!rootElem) throw new Error('No #root element on the page; ui/index_template.html should provide it.');

	// StrictMode is on so the construct-once gate in SimApp is exercised rather than assumed.
	createRoot(rootElem).render(
		<StrictMode>
			<SimApp player={player} def={def} />
		</StrictMode>,
	);
})();
