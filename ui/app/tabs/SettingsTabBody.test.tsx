import { SimHostProvider } from '@sim/context/SimHostContext';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Every block's contents are somebody else's component and are tested where they live. What is under
// test here is the assembly: which column a block lands in, in what order, whether it exists at all,
// and that nothing exists before the sim is ready.
vi.mock('@features/encounter', () => ({
	EncounterPicker: () => <div />,
	SavedEncounter: () => <div data-testid="saved-encounter-root" />,
}));
vi.mock('@features/settings', () => ({
	ConsumesPicker: () => <div />,
	CustomSection: ({ section }: { section: { id: string } }) => <div data-testid="custom-section-stub" data-id={section.id} />,
	OtherSettings: () => <div />,
	PlayerSettings: () => <div />,
	RaidBuffs: () => <div />,
	SavedSettings: () => <div data-testid="saved-settings-root" />,
	StatOptionIcons: ({ options }: { options: ReadonlyArray<unknown> }) => <div data-testid="stat-option-icons-root" data-count={options.length} />,
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

// The one component the tab deliberately does *not* port. It is constructed straight into the
// React-rendered panel, so what matters is that it lands there and that nothing wraps it.
// The preset picker is a React component now, so it renders for real. It needs only the builds list
// off the host, and this host declares none — which is the common case: five specs ship no builds.
// Needs a real player and store; SelectorModal.test.tsx is where it is asserted.
vi.mock('@features/gear/components/SelectorModal', () => ({ SelectorModal: () => null }));
vi.mock('../PresetConfigurationPicker', () => ({
	PresetConfigurationPicker: () => <div data-testid="preset-configuration-picker-root" data-saved-data-manager="" />,
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

const cols = (container: HTMLElement) => [...container.querySelectorAll('[data-testid="tab-panel-col"]')];

const blocks = (container: HTMLElement, colIndex: number) =>
	[...cols(container)[colIndex].querySelectorAll(':scope > [data-testid="content-block"]')].map(block => (block as HTMLElement).dataset.block);

const bodyOf = (container: HTMLElement, block: string) => container.querySelector(`[data-block="${block}"] > [data-testid="content-block-body"]`);

describe('SettingsTabBody', () => {
	beforeEach(() => {
		lists.value = { buffs: [{}], debuffs: [{}], externalDamage: [{}], externalDefensive: [{}] };
	});

	it('renders the panels and the three columns before the sim is ready, and nothing in them', () => {
		const container = mount();
		expect(container.querySelector('[data-testid="tab-panel-left"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="tab-panel-right"]')).not.toBeNull();
		expect(container.querySelectorAll('[data-testid="tab-panel-col"]')).toHaveLength(3);
		// A block that rendered early would read the database before it loads.
		expect(container.querySelectorAll('[data-testid="content-block"]')).toHaveLength(0);
	});

	it('fills each column in the order the vanilla builder appended', async () => {
		const container = mount({ sections: [{ id: 'totems' }] });
		await becomeReady();
		expect(blocks(container, 0)).toEqual(['encounter-settings', 'player-settings']);
		expect(blocks(container, 1)).toEqual(['consumes-settings', 'other-settings']);
		expect(blocks(container, 2)).toEqual(['buffs-settings', 'buffs-settings', 'buffs-settings', 'debuffs-settings']);
		// The custom section owns its own block, so it is not a content-block child of the column.
		expect(cols(container)[1].querySelector(':scope > [data-testid="custom-section-stub"]')).not.toBeNull();
		const firstChild = cols(container)[1].firstElementChild!;
		expect(firstChild.getAttribute('data-testid')).toBe('custom-section-stub');
	});

	// No wrapper element around any of the three: the preset picker has to keep leading the two
	// saved-data panels.
	it('renders the preset picker ahead of the two saved-data panels, with nothing wrapping them', () => {
		const container = mount();
		const right = container.querySelector('[data-testid="tab-panel-right"]')!;

		expect([...right.children].map(child => child.getAttribute('data-testid'))).toEqual([
			'preset-configuration-picker-root',
			'saved-encounter-root',
			'saved-settings-root',
		]);
	});

	// React re-renders instead of remounting, so this guards against a duplicated element.
	it('keeps one preset picker when the sim becomes ready', async () => {
		const container = mount();
		await becomeReady();
		expect(container.querySelectorAll('[data-testid="preset-configuration-picker-root"]')).toHaveLength(1);
	});

	it('omits the other-settings block when the spec declares neither inputs nor swap slots', async () => {
		const container = mount({ otherInputs: { inputs: [] } });
		await becomeReady();
		expect(blocks(container, 1)).toEqual(['consumes-settings']);
	});

	it('keeps the other-settings block for a spec with swap slots and no inputs', async () => {
		const container = mount({ otherInputs: { inputs: [] }, itemSwapSlots: [1] });
		await becomeReady();
		expect(blocks(container, 1)).toEqual(['consumes-settings', 'other-settings']);
	});

	it('omits an external-cooldown block whose option list filters to nothing', async () => {
		lists.value = { buffs: [{}], debuffs: [{}], externalDamage: [], externalDefensive: [{}] };
		const container = mount();
		await becomeReady();
		expect(cols(container)[2].querySelectorAll(':scope > [data-testid="content-block"]')).toHaveLength(3);
		// The one that survived is still the defensive block, so the guards are not interchangeable.
		expect(container.querySelectorAll('[data-testid="stat-option-icons-root"]')).toHaveLength(2);
	});

	it('renders no buffs or debuffs body when their own option lists are empty', async () => {
		lists.value = { buffs: [], debuffs: [], externalDamage: [], externalDefensive: [] };
		const container = mount();
		await becomeReady();
		expect(container.querySelector('[data-block="buffs-settings"]')).not.toBeNull();
		expect(bodyOf(container, 'buffs-settings')).toBeNull();
		expect(bodyOf(container, 'debuffs-settings')).toBeNull();
	});

	it('leaves those bodies alone when the lists are not empty', async () => {
		const container = mount();
		await becomeReady();
		expect(bodyOf(container, 'buffs-settings')).not.toBeNull();
		expect(bodyOf(container, 'debuffs-settings')).not.toBeNull();
	});
});
