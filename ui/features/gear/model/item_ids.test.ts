import { ReforgeData } from '@sim/proto_utils/equipped_item';
import { ItemLevelState } from '@generated/proto/common';
import { UIEnchant as Enchant, UIGem as Gem, UIItem as Item } from '@generated/proto/ui';
import { describe, expect, it } from 'vitest';

import { SelectorModalTabs } from '../types';
import { getItemIdByItemType } from './item_ids';

describe('getItemIdByItemType', () => {
	it('reads effectId on the enchant and tinker tabs, not id', () => {
		const enchant = { id: 1, effectId: 4444 } as unknown as Enchant;
		expect(getItemIdByItemType(SelectorModalTabs.Enchants, enchant)).toBe(4444);
		expect(getItemIdByItemType(SelectorModalTabs.Tinkers, enchant)).toBe(4444);
	});

	it('reads the reforge’s own id on the reforging tab', () => {
		expect(getItemIdByItemType(SelectorModalTabs.Reforging, { id: 1, reforge: { id: 148 } } as unknown as ReforgeData)).toBe(148);
	});

	it('reads id on the item, gem and random-suffix tabs', () => {
		expect(getItemIdByItemType(SelectorModalTabs.Items, { id: 5 } as unknown as Item)).toBe(5);
		expect(getItemIdByItemType(SelectorModalTabs.Gem3, { id: 6 } as unknown as Gem)).toBe(6);
		expect(getItemIdByItemType(SelectorModalTabs.RandomSuffixes, { id: 7 } as never)).toBe(7);
	});

	it('is the upgrade step itself on the upgrades tab', () => {
		expect(getItemIdByItemType(SelectorModalTabs.Upgrades, ItemLevelState.UpgradeStepTwo)).toBe(ItemLevelState.UpgradeStepTwo);
	});

	it('survives a null item on every tab', () => {
		expect(getItemIdByItemType(SelectorModalTabs.Enchants, null)).toBeUndefined();
		expect(getItemIdByItemType(SelectorModalTabs.Items, undefined)).toBeUndefined();
	});
});
