import { SimHostProvider } from '@features/SimHostContext';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Every block's contents are somebody else's component and are tested where they live. What is under
// test here is the assembly: which column a block lands in, in what order, whether it exists at all,
// and that nothing exists before the sim is ready.
vi.mock('@features/encounter', () => ({ EncounterPicker: () => <div className="encounter-picker-root" /> }));
vi.mock('@features/settings', () => ({
	ConsumesPicker: () => <div className="consumes-picker-root" />,
	CustomSection: ({ section }: { section: { id: string } }) => <div className="custom-section-stub" data-id={section.id} />,
	OtherSettings: () => <div className="other-settings-root" />,
	PlayerSettings: () => <div className="player-settings-root" />,
	RaidBuffs: () => <div className="raid-buffs-root" />,
	StatOptionIcons: ({ options }: { options: ReadonlyArray<unknown> }) => <div className="stat-option-icons-root" data-count={options.length} />,
}));

// The option lists are looked up by identity, so the real config arrays are stand-ins for a name and
// `relevantStatOptions` is the dial this file turns to make a block appear or vanish.
vi.mock('@features/settings/model/buffs_debuffs', () => ({
	RAID_BUFFS_CONFIG: 'buffs',
	RAID_BUFFS_MISC_CONFIG: 'buffsMisc',
	DEBUFFS_CONFIG: 'debuffs',
	RAID_BUFFS_EXTERNAL_DAMAGE_COOLDOWN: 'externalDamage',
	RAID_BUFFS_EXTERNAL_DEFENSIVE_COOLDOWN: 'externalDefensive',
}));
vi.mock('@features/settings/model/consumables', () => ({ CONJURED_CONFIG: 'conjured', EXPLOSIVE_CONFIG: 'explosive' }));

const lists = vi.hoisted(() => ({ value: {} as Record<string, Array<unknown>> }));
vi.mock('@features/settings/model/stat_options', () => ({
	relevantStatOptions: (config: string) => lists.value[config] ?? [],
}));
vi.mock('@features/settings/model/saved_settings', () => ({ readSavedSettings: () => ({}), applySavedSettings: () => {} }));

// The store sources need a player with a live zustand store; the managers below never read them.
const noopSubscribe = () => () => {};
vi.mock('@domain/state/subscriptions', () => ({
	subscribeAll: () => noopSubscribe,
	subscribeEncounterChange: () => noopSubscribe,
	subscribePartyBuffs: () => noopSubscribe,
	subscribePlayerField: () => noopSubscribe,
	subscribeRaidField: () => noopSubscribe,
}));

// The two components the tab deliberately does *not* port. They are constructed straight into the
// React-rendered panel, so what matters is that they land there and that nothing wraps them.
const built = vi.hoisted(() => ({ presets: 0, managers: 0 }));
class Legacy {
	readonly rootElem: HTMLElement;
	constructor(parent: HTMLElement, cssClass: string) {
		this.rootElem = document.createElement('div');
		this.rootElem.className = cssClass;
		parent.appendChild(this.rootElem);
	}
	dispose() {}
}
vi.mock('../preset_configuration_picker', () => ({
	PresetConfigurationPicker: class extends Legacy {
		constructor(parent: HTMLElement) {
			super(parent, 'preset-configuration-picker-root');
			built.presets++;
		}
	},
}));
vi.mock('@ui-kit/saved_data_manager', () => ({
	SavedDataManager: class extends Legacy {
		constructor(parent: HTMLElement) {
			super(parent, 'saved-data-manager-root');
			built.managers++;
		}
		loadUserData() {}
		addSavedData() {}
	},
}));

const { SettingsTabBody } = await import('./SettingsTabBody');

interface Config {
	sections?: Array<{ id: string }>;
	otherInputs: { inputs: Array<unknown> };
	itemSwapSlots?: Array<number>;
}

let resolveInit: () => void;
const hostWith = (config: Partial<Config> = {}) => ({
	sim: {
		waitForInit: () => new Promise<void>(resolve => (resolveInit = resolve)),
		encounter: {},
		raid: {},
	},
	player: { getParty: () => ({}) },
	individualConfig: {
		encounterPicker: { showExecuteProportion: true },
		playerIconInputs: [],
		playerInputs: { inputs: [] },
		epStats: [],
		petConsumeInputs: [],
		otherInputs: { inputs: [{ id: 'challenge-mode' }] },
		presets: {},
		...config,
	},
	getSavedEncounterStorageKey: () => 'encounters',
	getSavedSettingsStorageKey: () => 'settings',
});

const mount = (config?: Partial<Config>) => {
	const { container } = render(
		<SimHostProvider host={hostWith(config) as never}>
			<SettingsTabBody />
		</SimHostProvider>,
	);
	return container;
};

/** Resolves `waitForInit` and lets the status hook's state update flush. */
const becomeReady = async () => {
	await act(async () => {
		resolveInit();
	});
};

const blocks = (container: HTMLElement, column: string) =>
	[...container.querySelectorAll(`.${column} > .content-block`)].map(block => [...block.classList].find(name => name !== 'content-block'));

const bodyOf = (container: HTMLElement, cssClass: string) => container.querySelector(`.${cssClass} > .content-block-body`)!;

describe('SettingsTabBody', () => {
	beforeEach(() => {
		lists.value = { buffs: [{}], debuffs: [{}], externalDamage: [{}], externalDefensive: [{}] };
		built.presets = 0;
		built.managers = 0;
	});

	it('renders the panels and the three columns before the sim is ready, and nothing in them', () => {
		const container = mount();
		expect(container.querySelector('.settings-tab-left.tab-panel-left')).not.toBeNull();
		expect(container.querySelector('.settings-tab-right.tab-panel-right')).not.toBeNull();
		expect(container.querySelectorAll('.tab-panel-col')).toHaveLength(3);
		// The vanilla tab built the columns in its constructor and everything in them inside one
		// `waitForInit` callback. A block that rendered early would read the database before it loads.
		expect(container.querySelectorAll('.content-block')).toHaveLength(0);
	});

	it('fills each column in the order the vanilla builder appended', async () => {
		const container = mount({ sections: [{ id: 'totems' }] });
		await becomeReady();
		expect(blocks(container, 'settings-left-col-1')).toEqual(['encounter-settings', 'player-settings']);
		expect(blocks(container, 'settings-left-col-2')).toEqual(['consumes-settings', 'other-settings']);
		expect(blocks(container, 'settings-left-col-3')).toEqual(['buffs-settings', 'buffs-settings', 'buffs-settings', 'debuffs-settings']);
		// The custom section owns its own block, so it is not a `.content-block` child of the column.
		expect(container.querySelector('.settings-left-col-2 > .custom-section-stub')).not.toBeNull();
		expect(container.querySelector('.settings-left-col-2')!.firstElementChild!.className).toBe('custom-section-stub');
	});

	it('mounts the preset picker and both saved-data managers into the right panel itself', () => {
		const container = mount();
		const right = container.querySelector('.settings-tab-right')!;
		// `useLegacyMount`, not a host component: a wrapper div here would change the pane's DOM and
		// `panes-parity.mjs` compares it element for element.
		expect([...right.children].map(child => child.className)).toEqual([
			'preset-configuration-picker-root',
			'saved-data-manager-root',
			'saved-data-manager-root',
		]);
	});

	it('builds the right panel once, and not again when the sim becomes ready', async () => {
		mount();
		await becomeReady();
		expect(built.presets).toBe(1);
		expect(built.managers).toBe(2);
	});

	it('omits the other-settings block when the spec declares neither inputs nor swap slots', async () => {
		const container = mount({ otherInputs: { inputs: [] } });
		await becomeReady();
		expect(blocks(container, 'settings-left-col-2')).toEqual(['consumes-settings']);
	});

	it('keeps the other-settings block for a spec with swap slots and no inputs', async () => {
		const container = mount({ otherInputs: { inputs: [] }, itemSwapSlots: [1] });
		await becomeReady();
		expect(blocks(container, 'settings-left-col-2')).toEqual(['consumes-settings', 'other-settings']);
	});

	it('omits an external-cooldown block whose option list filters to nothing', async () => {
		lists.value = { buffs: [{}], debuffs: [{}], externalDamage: [], externalDefensive: [{}] };
		const container = mount();
		await becomeReady();
		expect(container.querySelectorAll('.settings-left-col-3 > .content-block')).toHaveLength(3);
		// The one that survived is still the defensive block, so the guards are not interchangeable.
		expect(container.querySelectorAll('.stat-option-icons-root')).toHaveLength(2);
	});

	it('hides the buffs and debuffs bodies when their own option lists are empty', async () => {
		lists.value = { buffs: [], debuffs: [], externalDamage: [], externalDefensive: [] };
		const container = mount();
		await becomeReady();
		expect(bodyOf(container, 'buffs-settings').classList.contains('hide')).toBe(true);
		expect(bodyOf(container, 'debuffs-settings').classList.contains('hide')).toBe(true);
	});

	it('leaves those bodies alone when the lists are not empty', async () => {
		const container = mount();
		await becomeReady();
		expect(bodyOf(container, 'buffs-settings').className).toBe('content-block-body');
		expect(bodyOf(container, 'debuffs-settings').className).toBe('content-block-body');
	});
});
