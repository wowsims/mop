import { describe, expect, it, vi } from 'vitest';

vi.mock('@i18n/config', () => ({ default: { t: (key: string) => key } }));
vi.mock('@i18n/localization', () => ({ translatePresetConfigurationCategory: (category: string) => `category:${category}` }));

const { buildCategories } = await import('./preset_build_state');

const build = (parts: Record<string, unknown>) => ({ name: 'P1', ...parts }) as any;

describe('buildCategories', () => {
	it('names each top-level category a build carries, and never the build name', () => {
		expect(buildCategories(build({ gear: {}, talents: {} }))).toEqual(['category:gear', 'category:talents']);
	});

	// `encounter`, `settings` and `reforgeSettings` are excluded from the key walk and then added back
	// by their own rules, so a build carrying only `encounter.encounter` still lists the category.
	it('reads the encounter category off the nested field rather than the key', () => {
		expect(buildCategories(build({ encounter: {} }))).toEqual([]);
		expect(buildCategories(build({ encounter: { encounter: {} } }))).toEqual(['category:encounter']);
	});

	it('folds every settings key except buffs into one label, and lists buffs once', () => {
		expect(buildCategories(build({ settings: { options: {}, consumes: {}, race: 1, buffs: {}, raidBuffs: {} } }))).toEqual([
			'common.preset.buffs',
			'common.preset.class_spec_options',
			'common.preset.consumables',
			'common.preset.other_settings',
		]);
	});

	it('de-duplicates and sorts, so two settings keys of the same kind read once', () => {
		const categories = buildCategories(build({ settings: { race: 1, profession1: 2 } }));
		expect(categories).toEqual(['common.preset.other_settings']);
	});

	// `reforgeSettings` is excluded from the key walk and re-added by its own rule, so it reads once.
	// `epWeights` is **not** excluded, so it is picked up by both and the tooltip lists the same thing
	// twice under two names. Pinned as it behaves rather than as it reads.
	it('lists reforge settings once, and stat weights twice, under two names', () => {
		expect(buildCategories(build({ reforgeSettings: {} }))).toEqual(['Reforge Settings']);
		expect(buildCategories(build({ epWeights: {} }))).toEqual(['category:epWeights', 'common.preset.stat_weights']);
	});
});
