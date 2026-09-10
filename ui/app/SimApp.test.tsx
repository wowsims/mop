import { LaunchStatus, Phase } from '@sim/constants/other';
import { createSimStore } from '@sim/state/sim_store';
import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The shell is stubbed on purpose. What is under test is the construct-once gate, not the shell —
// and constructing the real one would need a Database and a worker.
const constructions: Array<{ root: HTMLElement; sidebarActions: HTMLElement }> = [];
// Recorded rather than read off the document: the container the panes render into is only ever a
// child of a shell this test does not build.
const paneContainers: Array<HTMLElement> = [];
vi.mock('./individual_sim_ui', async () => {
	const { SidebarRegistry } = await import('@ui-kit/sidebar_registry');
	const { CrashReportOpener } = await import('./crash_report_opener');
	const { SimTabActivation } = await import('@ui-kit/tab_activation');
	return {
		SimHostObject: class {
			readonly simTabContentsContainer = document.createElement('main');
			// `NoticeNativeSim` asks the host's sim whether this is a local build; a native one raises no notice.
			readonly sim = { waitForInit: () => Promise.resolve(), isNative: true };
			readonly tabs = new SimTabActivation();
			readonly sidebar = new SidebarRegistry();
			readonly disabled = false;
			readonly individualConfig = { displayStats: [], epReferenceStat: 0 };
			readonly simActionsContainer: HTMLElement;
			// The sidebar panel is React now; the shell only owns the store it drives and the registry
			// the warnings zone reads.
			readonly resultsPanel = {} as never;
			readonly warnings = {} as never;
			readonly raidSimResultsManager = {} as never;
			readonly crashReport = new CrashReportOpener();
			constructor(dom: { root: HTMLElement; sidebarActions: HTMLElement }) {
				constructions.push(dom);
				paneContainers.push(this.simTabContentsContainer);
				this.simActionsContainer = dom.sidebarActions;
			}
		},
	};
});

// The six real panes need a Database and a worker; what is under test is that the tab tree is handed
// the container the shell built, so the stub portals one marker into it.
vi.mock('./SimTabsSection', async () => {
	const { createElement } = await import('react');
	const { createPortal } = await import('react-dom');
	return {
		SimTabsSection: ({ host }: { host: { simTabContentsContainer: HTMLElement } }) =>
			createPortal(createElement('div', { className: 'gear-tab-left' }), host.simTabContentsContainer),
	};
});
// Every import and export dialog reads the item database.
vi.mock('./SimImportExport', () => ({ SimImportExport: () => <div className="import-export-menus" /> }));
// Both reach through the host for the run facade; SidebarActions.test.tsx asserts the sidebar's gate.
vi.mock('@features/results/components/SimulateAction', () => ({ SimulateAction: () => <button className="dps-action" /> }));
vi.mock('@features/stat-weights/components/StatWeightsAction', () => ({ StatWeightsAction: () => <button className="ep-weights-action" /> }));

// The real one needs a Player with a live store; what is under test here is the portal, not it.
vi.mock('@features/character-stats', () => ({ CharacterStats: () => <div className="character-stats-root" /> }));
vi.mock('@features/results/components/SimResultsPanel', () => ({ SimResultsPanel: () => <div className="results-viewer" /> }));
vi.mock('@features/stat-weights/components/EpWeightsDialog', () => ({ EpWeightsDialog: () => <div className="ep-weights-dialog-root" /> }));
// Six pickers over a real Sim and a Base UI portal into `host.rootElem`; SettingsDialog.test.tsx is where those are asserted.
vi.mock('./SettingsDialog', () => ({ SettingsDialog: () => <div className="settings-menu-root" /> }));
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
	// The shell renders the iterations picker itself, so this stub is its source too, not just the host's.
	getIterations: () => 3000,
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
		paneContainers.length = 0;
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

	it('renders the sidebar stats into the container the shell built', () => {
		const { container } = render(<SimApp player={player} def={def} />);
		expect(container.querySelectorAll('.sim-sidebar-stats .character-stats-root')).toHaveLength(1);
	});

	it('renders the results panel into the container the shell built', () => {
		const { container } = render(<SimApp player={player} def={def} />);
		expect(container.querySelectorAll('.sim-sidebar-results .results-viewer')).toHaveLength(1);
	});

	it('renders each registered pane into the pane container the shell built', () => {
		render(<SimApp player={player} def={def} />);
		expect(paneContainers[0].querySelectorAll('.gear-tab-left')).toHaveLength(1);
	});

	it('renders it exactly once under StrictMode', () => {
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
		dom.sidebarActions.appendChild(marker);

		// `setSimUI` has already re-rendered by now; the nodes must have survived it.
		expect(container.querySelector('.sim-ui')).toBe(dom.root);
		expect(dom.sidebarActions.isConnected).toBe(true);
		expect(dom.sidebarActions.querySelector('.built-imperatively')).toBe(marker);
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
