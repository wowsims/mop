import { createSimStore } from '@domain/state/sim_store';
import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The shell is stubbed on purpose. What is under test is the construct-once gate, not the shell —
// and constructing the real one would need a Database and a worker.
const constructions: Array<{ root: HTMLElement; sidebarStats: HTMLElement }> = [];
vi.mock('./individual_sim_ui', async () => {
	const { SimTabRegistry } = await import('@ui-kit/tab_registry');
	return {
		IndividualSimUI: class {
			readonly simTabContentsContainer = document.createElement('main');
			readonly simHeader = { simTabsContainer: document.createElement('ul') };
			readonly tabs = new SimTabRegistry(this.simTabContentsContainer);
			readonly individualConfig = { displayStats: [], epReferenceStat: 0 };
			readonly sidebarStatsContainer: HTMLElement;
			// React fills the talents tab body through this, the same way it fills the sidebar.
			readonly talentsTab = { contentContainer: document.createElement('div') };
			// The shell no longer builds its own markup — it adopts the bundle `buildShellDom` made,
			// and `Component`'s `rootCssClass` is what puts `sim-ui` on the root.
			constructor(dom: { root: HTMLElement; sidebarStats: HTMLElement }) {
				constructions.push(dom);
				dom.root.classList.add('sim-ui');
				this.sidebarStatsContainer = dom.sidebarStats;
			}
		},
	};
});

// The real one needs a Player with a live store; what is under test here is the portal, not it.
vi.mock('@features/character-stats', () => ({ CharacterStats: () => <div className="character-stats-root" /> }));
vi.mock('./tabs/TalentsTabBody', () => ({ TalentsTabBody: () => <div className="talents-tab-left" /> }));

const { SimApp } = await import('./SimApp');

// The shell reads the metric toggles off a real store — `subscribeUiField` selects from it — and the
// spec's shape decides the `sim-type--*` class, so both have to be genuine rather than empty casts.
const sim = {
	store: createSimStore(),
	getShowDamageMetrics: () => true,
	getShowThreatMetrics: () => false,
	getShowHealingMetrics: () => false,
	getShowExperimental: () => false,
};
const spec = { isHealingSpec: false, isTankSpec: false, isMeleeDpsSpec: true, isRangedDpsSpec: false };
const player = { sim, getPlayerSpec: () => spec } as never;
const def = { cssClass: 'arms-warrior-sim-ui' } as never;

describe('SimApp', () => {
	beforeEach(() => {
		constructions.length = 0;
	});

	it('constructs the shell once', () => {
		const { container } = render(<SimApp player={player} def={def} />);
		expect(constructions).toHaveLength(1);
		expect(container.querySelectorAll('.sim-ui')).toHaveLength(1);
	});

	it('still constructs once under StrictMode, whose effects run twice', () => {
		// This is the whole reason the gate exists. Constructing the shell subscribes autosave with no
		// unsubscribe and queues work on sim.waitForInit(), so a second construction cannot be undone
		// by a cleanup function — it has to not happen.
		const { container } = render(
			<StrictMode>
				<SimApp player={player} def={def} />
			</StrictMode>,
		);
		expect(constructions).toHaveLength(1);
		expect(container.querySelectorAll('.sim-ui')).toHaveLength(1);
	});

	it('portals the sidebar stats into the container the shell built', () => {
		render(<SimApp player={player} def={def} />);
		expect(constructions[0].sidebarStats.querySelectorAll('.character-stats-root')).toHaveLength(1);
	});

	it('portals it exactly once under StrictMode', () => {
		render(
			<StrictMode>
				<SimApp player={player} def={def} />
			</StrictMode>,
		);
		expect(document.querySelectorAll('.character-stats-root')).toHaveLength(1);
	});

	// The failure this guards against is silent: React re-renders when `simUI` is set, and if the
	// skeleton were recreated in that second render, every element the shell imperatively filled
	// during construction would be discarded with the old nodes.
	it('keeps the same skeleton nodes when the constructed shell arrives', () => {
		const { container } = render(<SimApp player={player} def={def} />);
		const dom = constructions[0];
		const marker = document.createElement('span');
		marker.className = 'built-imperatively';
		dom.sidebarStats.appendChild(marker);

		// `setSimUI` has already re-rendered by now; the nodes must have survived it.
		expect(container.querySelector('.sim-ui')).toBe(dom.root);
		expect(dom.sidebarStats.isConnected).toBe(true);
		expect(dom.sidebarStats.querySelector('.built-imperatively')).toBe(marker);
	});

	it('mounts the shell into its own container', () => {
		const { container } = render(<SimApp player={player} def={def} />);
		const mount = container.querySelector('.sim-app')!;
		// The shell is handed a DOM bundle rather than a parent, so what ties it to the mount is the
		// bundle's root being a child of it.
		expect(constructions[0].root.parentElement).toBe(mount);
		expect(mount.querySelector('.sim-ui')).not.toBeNull();
	});
});
