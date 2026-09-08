import { GemColor, ItemLevelState, ItemQuality, Profession, ScalingItemProperties, Stat } from '@generated/proto/common';
import { UIEnchant as Enchant, UIGem as Gem, UIItem as Item } from '@generated/proto/ui';
import type { Player } from '@sim/player/player';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { describe, expect, it } from 'vitest';

import { SelectorModalTabs, type GearData } from '../../types';
import { buildSelectorTabs, eligibilityFor } from './utils';

const gearData: GearData = { equipItem: () => undefined, getEquippedItem: () => null, subscribe: () => () => undefined };

// `itemsTabData` builds a real `EquippedItem` per row, and that reads the base scaling entry.
const scalingOptions = { [ItemLevelState.Base]: ScalingItemProperties.create({ ilvl: 500 }) };

interface ItemStub {
	upgrades?: boolean;
	randomSuffixOptions?: number;
	randomSuffix?: object | null;
	sockets?: GemColor[];
}

const equippedItem = ({ upgrades = false, randomSuffixOptions = 0, randomSuffix = null, sockets = [] }: ItemStub) =>
	({
		item: Item.create({
			id: 1,
			name: 'Stub',
			quality: ItemQuality.ItemQualityEpic,
			ilvl: 500,
			scalingOptions,
			randomSuffixOptions: Array.from({ length: randomSuffixOptions }, (_, index) => index + 1),
			gemSockets: sockets,
			socketBonus: [],
		}),
		randomSuffix,
		_randomSuffix: randomSuffix,
		ilvlFromPrevious: 4,
		hasUpgradeOptions: () => upgrades,
		hasRandomSuffixOptions: () => randomSuffixOptions > 0,
		numSockets: () => sockets.length,
		curSocketColors: () => sockets,
		getUpgrades: () => ({ [ItemLevelState.Base]: { ilvl: 500 }, [ItemLevelState.UpgradeStepOne]: { ilvl: 504 } }),
		withUpgrade: () => ({ ilvlFromPrevious: 4 }),
		withRandomSuffix: () => ({ getRandomSuffixStats: () => ({ asProtoArray: () => [] }) }),
	}) as unknown as EquippedItem;

interface PlayerStub {
	items?: number;
	enchants?: number;
	tinkers?: number;
	gems?: number;
	reforges?: number;
	engineering?: boolean;
	challengeMode?: boolean;
	randomSuffixes?: number;
}

const player = ({ items = 1, enchants = 1, tinkers = 1, gems = 1, reforges = 1, engineering = false, challengeMode = false, randomSuffixes = 1 }: PlayerStub) =>
	({
		getItems: () => Array.from({ length: items }, (_, index) => Item.create({ id: index + 1, name: `Item ${index}`, ilvl: 500, scalingOptions })),
		getEnchants: () => Array.from({ length: enchants }, (_, index) => Enchant.create({ effectId: index + 1, name: `Enchant ${index}` })),
		getTinkers: () => Array.from({ length: tinkers }, (_, index) => Enchant.create({ effectId: index + 100, name: `Tinker ${index}` })),
		getGems: () => Array.from({ length: gems }, (_, index) => Gem.create({ id: index + 1, name: `Gem ${index}` })),
		getAvailableReforgings: () =>
			Array.from({ length: reforges }, (_, index) => ({
				id: index + 1,
				reforge: { id: index + 1, fromStat: Stat.StatStrength, toStat: Stat.StatAgility },
				fromStat: Stat.StatStrength,
				toStat: Stat.StatAgility,
				fromAmount: -10,
				toAmount: 10,
			})),
		getRandomSuffixes: () => Array.from({ length: randomSuffixes }, (_, index) => ({ id: index + 1, name: `Suffix ${index}` })),
		hasProfession: (profession: Profession) => engineering && profession === Profession.Engineering,
		getChallengeModeEnabled: () => challengeMode,
		computeItemEP: () => 1,
		computeEnchantEP: () => 1,
		computeGemEP: () => 1,
		computeReforgingEP: () => 1,
		computeRandomSuffixEP: () => 1,
		computeUpgradeEP: () => 1,
		computeStatsEP: () => 1,
	}) as unknown as Player<any>;

const labels = (options: { player: PlayerStub; item: ItemStub | null; isBlacksmithing?: boolean }) =>
	buildSelectorTabs({
		player: player(options.player),
		slot: 0,
		gearData,
		equippedItem: options.item ? equippedItem(options.item) : null,
		isBlacksmithing: options.isBlacksmithing ?? false,
	}).map(tab => tab.label);

describe('buildSelectorTabs', () => {
	it('offers only the item and enchant tabs for an empty slot', () => {
		expect(labels({ player: {}, item: null })).toEqual([SelectorModalTabs.Items, SelectorModalTabs.Enchants]);
	});

	it('drops a tab whose data is empty rather than showing it blank', () => {
		expect(labels({ player: { enchants: 0 }, item: null })).toEqual([SelectorModalTabs.Items]);
	});

	it('offers tinkers only to an engineer', () => {
		expect(labels({ player: { engineering: true }, item: null })).toContain(SelectorModalTabs.Tinkers);
		expect(labels({ player: {}, item: null })).not.toContain(SelectorModalTabs.Tinkers);
	});

	it('orders the tabs items, enchants, tinkers, suffix, upgrades, reforging, gems', () => {
		expect(
			labels({
				player: { engineering: true },
				item: { upgrades: true, randomSuffixOptions: 2, randomSuffix: { id: 1 }, sockets: [GemColor.GemColorRed] },
			}),
		).toEqual([
			SelectorModalTabs.Items,
			SelectorModalTabs.Enchants,
			SelectorModalTabs.Tinkers,
			SelectorModalTabs.RandomSuffixes,
			SelectorModalTabs.Upgrades,
			SelectorModalTabs.Reforging,
			SelectorModalTabs.Gem1,
		]);
	});

	it('withholds upgrades and reforging until an item with suffix options has one', () => {
		const without = labels({ player: {}, item: { upgrades: true, randomSuffixOptions: 2, randomSuffix: null } });
		expect(without).toContain(SelectorModalTabs.RandomSuffixes);
		expect(without).not.toContain(SelectorModalTabs.Upgrades);
		expect(without).not.toContain(SelectorModalTabs.Reforging);
	});

	it('builds one gem tab per socket the item currently has', () => {
		expect(labels({ player: {}, item: { sockets: [GemColor.GemColorRed, GemColor.GemColorBlue] } })).toEqual([
			SelectorModalTabs.Items,
			SelectorModalTabs.Enchants,
			SelectorModalTabs.Reforging,
			SelectorModalTabs.Gem1,
			SelectorModalTabs.Gem2,
		]);
	});

	it('still offers the upgrades tab in challenge mode, which is what eligibility disagrees about', () => {
		const options = { player: { challengeMode: true }, item: { upgrades: true } };
		expect(labels(options)).toContain(SelectorModalTabs.Upgrades);
		expect(eligibilityFor({ player: player(options.player), slot: 0, equippedItem: equippedItem(options.item), isBlacksmithing: false }).hasUpgrades).toBe(
			false,
		);
	});
});

describe('eligibilityFor', () => {
	it('reports what an empty slot offers', () => {
		expect(eligibilityFor({ player: player({}), slot: 0, equippedItem: null, isBlacksmithing: false })).toEqual({
			hasEnchants: true,
			hasReforges: false,
			hasUpgrades: false,
			socketCount: undefined,
		});
	});

	it('counts the sockets the item has right now', () => {
		expect(
			eligibilityFor({
				player: player({}),
				slot: 0,
				equippedItem: equippedItem({ sockets: [GemColor.GemColorRed] }),
				isBlacksmithing: false,
			}).socketCount,
		).toBe(1);
	});
});
