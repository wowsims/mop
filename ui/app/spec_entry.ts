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
import { nextEventID } from '@domain/state/batch';
import type { SpecDefinition } from '@features/spec_config';
import { registerSpecConfig } from '@features/spec_config';

import { IndividualSimUI } from './individual_sim_ui';

const modules = import.meta.glob<{ default: SpecDefinition<any> }>('../*/*/spec.{ts,tsx}');

// '/mop/warrior/arms/' -> '../warrior/arms/spec' (then tried as .ts and .tsx —
// a couple of specs need real JSX for their reforge tooltips).
function specModuleKey(pathname: string): string {
	const base = import.meta.env.BASE_URL || '/';
	const rel = (pathname.startsWith(base) ? pathname.slice(base.length) : pathname)
		.replace(/^\/+/, '')
		.replace(/index\.html$/, '')
		.replace(/\/+$/, '');
	return `../${rel}/spec`;
}

// An async IIFE rather than top-level await: the vite build target does not
// support TLA and downgrades it to a tolerated transform.
void (async () => {
	const key = specModuleKey(location.pathname);
	const loadSpec = modules[`${key}.ts`] || modules[`${key}.tsx`];
	if (!loadSpec) {
		throw new Error(`No spec module for ${location.pathname} (looked for ${key}.ts(x)). Specs not yet converted to spec.ts still ship their own index.ts.`);
	}

	const def = (await loadSpec()).default;

	// Ordering constraint, documented here once: `new Player()` resolves the
	// spec's config out of the registry in its constructor, so the definition has
	// to be registered before the player is built.
	registerSpecConfig(def.spec, def);

	const sim = new Sim({ env: browserEnv });
	const player = new Player(PlayerSpecs.fromProto(def.spec), sim);
	if (def.enableHealing) player.enableHealing();

	sim.raid.setPlayer(nextEventID(), 0, player);

	new IndividualSimUI(document.body, player, def);
})();
