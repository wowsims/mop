import { EquippedItem, ReforgeData } from '@sim/proto/equipped_item';
import { ItemQuality, ItemSlot, Stat } from '@generated/proto/common';
import { UIGem as Gem } from '@generated/proto/ui';

export type UpgradeSummaryTotal = {
	justicePoints: number;
	honorPoints: number;
	valorPoints: number;
};

export const COSTS = new Map<keyof UpgradeSummaryTotal, Map<ItemQuality, number>>([
	[
		'valorPoints',
		new Map<ItemQuality, number>([
			[ItemQuality.ItemQualityRare, 250],
			[ItemQuality.ItemQualityEpic, 250],
			[ItemQuality.ItemQualityLegendary, 250],
		]),
	],
	[
		'justicePoints',
		new Map<ItemQuality, number>([
			[ItemQuality.ItemQualityRare, 750],
			[ItemQuality.ItemQualityEpic, 1000],
			[ItemQuality.ItemQualityLegendary, 1000],
		]),
	],
	[
		'honorPoints',
		new Map<ItemQuality, number>([
			[ItemQuality.ItemQualityRare, 750],
			[ItemQuality.ItemQualityEpic, 1000],
			[ItemQuality.ItemQualityLegendary, 1000],
		]),
	],
]);

export const itemsWithUpgradeOptions = (items: Array<EquippedItem | null | undefined>): EquippedItem[] =>
	items.filter((item): item is EquippedItem => !!(item?._item.scalingOptions && item.getMaxUpgradeCount() > 0));

export const upgradeCostTotals = (items: EquippedItem[]): UpgradeSummaryTotal =>
	items.reduce<UpgradeSummaryTotal>(
		(acc, item) => {
			let key: keyof UpgradeSummaryTotal = 'justicePoints';

			if (item._item.name.includes("Gladiator's")) {
				key = 'honorPoints';
			} else if (item._item.phase === 5) {
				// Phase 5: Warforged items cost JP, everything else VP.
				key = item._item.nameDescription.includes('Warforged') ? 'justicePoints' : 'valorPoints';
			}

			acc[key] += (COSTS.get(key)?.get(item._item.quality) || 0) * (item.getMaxUpgradeCount() - item.upgrade);

			return acc;
		},
		{
			valorPoints: 0,
			justicePoints: 0,
			honorPoints: 0,
		},
	);

export interface GemSummaryData {
	gem: Gem;
	count: number;
}

export const gemSummaryRows = (gems: Gem[]): GemSummaryData[] => {
	const gemCounts: Record<string, GemSummaryData> = {};

	for (const gem of gems) {
		if (gemCounts[gem.name]) {
			gemCounts[gem.name].count += 1;
		} else {
			gemCounts[gem.name] = { gem, count: 1 };
		}
	}

	return Object.keys(gemCounts)
		.sort((a, b) => a.localeCompare(b))
		.map(gemName => gemCounts[gemName]);
};

export type ReforgeSummaryTotal = {
	[key in Stat]?: number;
};

export const reforgeTotals = (reforges: Map<ItemSlot, ReforgeData>): ReforgeSummaryTotal => {
	const totals: ReforgeSummaryTotal = {};

	for (const [_, reforgeData] of reforges) {
		const { fromStat, toStat, fromAmount, toAmount } = reforgeData;

		if (typeof totals[fromStat] !== 'number') {
			totals[fromStat] = 0;
		}
		if (typeof totals[toStat] !== 'number') {
			totals[toStat] = 0;
		}
		if (fromAmount) totals[fromStat]! += fromAmount;
		if (toAmount) totals[toStat]! += toAmount;
	}

	return totals;
};
