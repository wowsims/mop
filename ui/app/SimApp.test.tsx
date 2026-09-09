import { LaunchStatus, Phase } from '@sim/constants/other';
import { createSimStore } from '@sim/state/sim_store';
import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The shell is stubbed on purpose. What is under test is the construct-once gate, not the shell —
// and constructing the real one would need a Database and a worker.
const constructions: Array<{ root: HTMLElement; sidebarActions: HTMLElement; sidebarStats: HTMLElement; sidebarResults: HTMLElement }> = [];
// Recorded rather than read off the document: the div the results pane portals into is only ever a
// child of a shell this test does not build.
const resultsContainers: Array<HTMLElement> = [];
const NO_ENTRIES: ReadonlyArray<never> = [];
vi.mock('./individual_sim_ui', async () => {
	const { SidebarRegistry } = await import('@ui-kit/sidebar_registry');
	const { SimTabRegistry } = await import('@ui-kit/tab_registry');
	return {
		IndividualSimUI: class {
			readonly simTabContentsContainer = document.createElement('main');
			readonly simHeader = {
				simTabsContainer: document.createElement('ul'),
				// React portals the two dropdowns into this and reads their contents from the registry.
				importExportContainer: document.createElement('div'),
				// One frozen array, not a fresh one per call: `useSyncExternalStore` compares snapshots by
				// identity, so returning a new `[]` each time is an infinite render loop. The real
				// registry holds its arrays and only replaces them in `add`.
				importExport: { subscribe: () => () => {}, getEntries: () => NO_ENTRIES },
			};
			readonly tabs = new SimTabRegistry(this.simTabContentsContainer);
			readonly sidebar = new SidebarRegistry();
			readonly disabled = false;
			readonly individualConfig = { displayStats: [], epReferenceStat: 0 };
			readonly simActionsContainer: HTMLElement;
			readonly sidebarStatsContainer: HTMLElement;
			readonly sidebarResultsContainer: HTMLElement;
			// The sidebar panel is React now; the shell only owns the store it drives and the registry
			// the warnings zone reads.
			readonly resultsPanel = {} as never;
			readonly warnings = {} as never;
			// React fills the talents tab body through this, the same way it fills the sidebar.
			readonly gearTab = { contentContainer: document.createElement('div') };
			readonly talentsTab = { contentContainer: document.createElement('div') };
			readonly settingsTab = { contentContainer: document.createElement('div') };
			readonly rotationTab = { contentContainer: document.createElement('div') };
			// The results pane is React and owns its own metrics containers; the shell only builds the
			// div it renders into, and the manager and exporter factory it is handed.
			readonly detailedResultsContainer = document.createElement('div');
			readonly raidSimResultsManager = {} as never;
			readonly makeLogExporter = (() => ({ open: () => {} })) as never;
			// The shell no longer builds its own markup — it adopts the bundle `buildShellDom` made,
			// and `Component`'s `rootCssClass` is what puts `sim-ui` on the root.
			constructor(dom: { root: HTMLElement; sidebarActions: HTMLElement; sidebarStats: HTMLElement; sidebarResults: HTMLElement }) {
				constructions.push(dom);
				resultsContainers.push(this.detailedResultsContainer);
				dom.root.classList.add('sim-ui');
				this.simActionsContainer = dom.sidebarActions;
				this.sidebarStatsContainer = dom.sidebarStats;
				this.sidebarResultsContainer = dom.sidebarResults;
			}
		},
	};
});

// The real one needs a Player with a live store; what is under test here is the portal, not it.
vi.mock('@features/character-stats', () => ({ CharacterStats: () => <div className="character-stats-root" /> }));
vi.mock('@features/results/components/SimResultsPanel', () => ({ SimResultsPanel: () => <div className="results-viewer" /> }));
vi.mock('./tabs/GearTabBody', () => ({ GearTabBody: () => <div className="gear-tab-left" /> }));
vi.mock('./tabs/TalentsTabBody', () => ({ TalentsTabBody: () => <div className="talents-tab-left" /> }));
vi.mock('./tabs/SettingsTabBody', () => ({ SettingsTabBody: () => <div className="settings-tab-left" /> }));
vi.mock('./tabs/RotationTabBody', () => ({ RotationTabBody: () => <div className="rotation-tab rotation-tab-auto" /> }));
vi.mock('@features/stat-weights/components/EpWeightsDialog', () => ({ EpWeightsDialog: () => <div className="ep-weights-dialog-root" /> }));
// The pane builds six vanilla islands and seven tables of its own; DetailedResults.test.tsx is where those are asserted.
vi.mock('@features/results/components/DetailedResults', () => ({ DetailedResults: () => <div className="detailed-results-manager-root" /> }));
// Needs the real spec registry to list every class; what is under test here is the shell's gate.
vi.mock('./header/SimTitleDropdown', () => ({ SimTitleDropdown: () => <div className="sim-title-dropdown-root" /> }));

// The toolbar asks a local sim host whether it is outdated, and happy-dom's hostname is localhost,
// so it takes that branch. Left in flight, the request is aborted at teardown and the rejection is
// printed; refused outright it takes the toolbar's own `.catch(noop)`, which is the real path.
vi.stubGlobal('fetch', () => Promise.reject(new Error('no sim host')));

const { SimApp } = await import('./SimApp');

// The shell reads the metric toggles off a real store — `subscribeUiField` selects from it — and the
// spec's shape decides the `sim-type--*` class, so both have to be genuine rather than empty casts.
const sim = {
	store: createSimStore(),
	// The tab bodies gate their own content on this; `SimApp` only portals them in.
	waitForInit: () => Promise.resolve(),
	getShowDamageMetrics: () => true,
	getShowThreatMetrics: () => false,
	getShowHealingMetrics: () => false,
	getShowExperimental: () => false,
};
// `launch` is real because the shell derives the known-issues list from it — a launched spec earns
// no status notice, so the toolbar's link ships hidden.
const spec = {
	isHealingSpec: false,
	isTankSpec: false,
	isMeleeDpsSpec: true,
	isRangedDpsSpec: false,
	launch: { phase: Phase.Phase1, status: LaunchStatus.Launched },
};
const player = { sim, getPlayerSpec: () => spec } as never;
const def = { cssClass: 'arms-warrior-sim-ui', encounterPicker: { showExecuteProportion: true } } as never;

describe('SimApp', () => {
	beforeEach(() => {
		constructions.length = 0;
		resultsContainers.length = 0;
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

	it('portals the results panel into the container the shell built', () => {
		render(<SimApp player={player} def={def} />);
		expect(constructions[0].sidebarResults.querySelectorAll('.results-viewer')).toHaveLength(1);
	});

	it('portals the results pane into the div the shell built', () => {
		render(<SimApp player={player} def={def} />);
		expect(resultsContainers[0].querySelectorAll('.detailed-results-manager-root')).toHaveLength(1);
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
