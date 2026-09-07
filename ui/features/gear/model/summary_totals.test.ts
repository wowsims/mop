import { EquippedItem, ReforgeData } from '@sim/proto_utils/equipped_item';
import { ItemQuality, ItemSlot, Stat } from '@generated/proto/common';
import { UIGem as Gem } from '@generated/proto/ui';
import { describe, expect, it } from 'vitest';

import { gemSummaryRows, itemsWithUpgradeOptions, reforgeTotals, upgradeCostTotals } from './summary_totals';

const gem = (name: string) => ({ name }) as unknown as Gem;

const equipped = (over: {
	name?: string;
	nameDescription?: string;
	phase?: number;
	quality?: ItemQuality;
	scaling?: boolean;
	maxUpgrades?: number;
	upgrade?: number;
}) =>
	({
		_item: {
			name: over.name ?? 'Item',
			nameDescription: over.nameDescription ?? '',
			phase: over.phase ?? 1,
			quality: over.quality ?? ItemQuality.ItemQualityEpic,
			scalingOptions: over.scaling === false ? undefined : {},
		},
		upgrade: over.upgrade ?? 0,
		getMaxUpgradeCount: () => over.maxUpgrades ?? 2,
	}) as unknown as EquippedItem;

const reforge = (fromStat: Stat, toStat: Stat, fromAmount: number, toAmount: number) => ({ fromStat, toStat, fromAmount, toAmount }) as unknown as ReforgeData;

describe('gemSummaryRows', () => {
	it('counts duplicates and orders by name', () => {
		expect(gemSummaryRows([gem('Zen'), gem('Adept'), gem('Zen')]).map(row => [row.gem.name, row.count])).toEqual([
			['Adept', 1],
			['Zen', 2],
		]);
	});

	it('is empty for no gems', () => {
		expect(gemSummaryRows([])).toEqual([]);
	});
});

describe('reforgeTotals', () => {
	it('adds every reforge on both sides, keeping the from-side negative', () => {
		const totals = reforgeTotals(
			new Map<ItemSlot, ReforgeData>([
				[ItemSlot.ItemSlotHead, reforge(Stat.StatHitRating, Stat.StatCritRating, -100, 100)],
				[ItemSlot.ItemSlotChest, reforge(Stat.StatHitRating, Stat.StatHasteRating, -60, 60)],
			]),
		);
		expect(totals[Stat.StatHitRating]).toBe(-160);
		expect(totals[Stat.StatCritRating]).toBe(100);
		expect(totals[Stat.StatHasteRating]).toBe(60);
	});

	it('is an empty object when nothing is reforged, which is what hides the block', () => {
		expect(Object.keys(reforgeTotals(new Map()))).toEqual([]);
	});
});

describe('itemsWithUpgradeOptions', () => {
	it('keeps only scaling items that still have steps to buy', () => {
		const scaling = equipped({});
		expect(itemsWithUpgradeOptions([null, undefined, equipped({ scaling: false }), equipped({ maxUpgrades: 0 }), scaling])).toEqual([scaling]);
	});
});

describe('upgradeCostTotals', () => {
	it('charges justice points by default, per remaining step', () => {
		expect(upgradeCostTotals([equipped({ maxUpgrades: 2, upgrade: 0 })])).toEqual({ justicePoints: 2000, honorPoints: 0, valorPoints: 0 });
	});

	it("charges honor for a Gladiator's item whatever its phase", () => {
		expect(upgradeCostTotals([equipped({ name: "Gladiator's Greatsword", phase: 5, maxUpgrades: 1 })])).toEqual({
			justicePoints: 0,
			honorPoints: 1000,
			valorPoints: 0,
		});
	});

	it('charges valor in phase 5, except for Warforged which stays on justice', () => {
		expect(upgradeCostTotals([equipped({ phase: 5, maxUpgrades: 1 })]).valorPoints).toBe(250);
		expect(upgradeCostTotals([equipped({ phase: 5, nameDescription: 'Warforged', maxUpgrades: 1 })]).justicePoints).toBe(1000);
	});

	it('bills only the steps not yet bought', () => {
		expect(upgradeCostTotals([equipped({ maxUpgrades: 2, upgrade: 2 })]).justicePoints).toBe(0);
	});

	it('charges nothing for a quality with no price', () => {
		expect(upgradeCostTotals([equipped({ quality: ItemQuality.ItemQualityUncommon, maxUpgrades: 2 })]).justicePoints).toBe(0);
	});
});
