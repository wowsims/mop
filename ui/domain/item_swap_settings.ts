import { ItemSlot, ItemSpec, ItemSwap } from '@generated/proto/common';

import type { Player } from './player';
import { EquippedItem } from './proto_utils/equipped_item';
import { ItemSwapGear } from './proto_utils/gear';
import { Stats } from './proto_utils/stats';
// Facade over the player's itemSwap* store fields (one shared `itemSwap`
// version counter, see Player.patchItemSwap).
export class ItemSwapSettings {
	private readonly player: Player<any>;

	constructor(player: Player<any>) {
		this.player = player;
	}

	setItemSwapSettings(enableItemSwap: boolean, gear: ItemSwapGear, bonusStats?: Stats) {
		this.player.patchItemSwap({ itemSwapEnabled: enableItemSwap, itemSwapGear: gear, itemSwapBonusStats: bonusStats || new Stats() });
	}

	setBonusStats(stats: Stats) {
		this.player.patchItemSwap({ itemSwapBonusStats: stats });
	}

	getBonusStats(): Stats {
		return this.player.getItemSwapField('itemSwapBonusStats');
	}

	getEnableItemSwap(): boolean {
		return this.player.getItemSwapField('itemSwapEnabled');
	}

	setEnableItemSwap(newEnableItemSwap: boolean) {
		if (newEnableItemSwap == this.getEnableItemSwap()) return;
		this.player.patchItemSwap({ itemSwapEnabled: newEnableItemSwap });
	}

	equipItem(slot: ItemSlot, newItem: EquippedItem | null) {
		this.setGear(this.getGear().withEquippedItem(slot, newItem, this.player.canDualWield2H()));
	}

	getItem(slot: ItemSlot): EquippedItem | null {
		return this.getGear().getEquippedItem(slot);
	}

	getGear(): ItemSwapGear {
		return this.player.getItemSwapField('itemSwapGear');
	}

	setGear(newItemSwapGear: ItemSwapGear) {
		if (newItemSwapGear.equals(this.getGear())) return;
		this.player.patchItemSwap({ itemSwapGear: newItemSwapGear });
	}

	toProto(): ItemSwap {
		return ItemSwap.create({
			prepullBonusStats: this.getBonusStats().toProto(),
			items: this.getGear()
				.asArray()
				.map(ei => (ei ? ei.asSpec() : ItemSpec.create())),
		});
	}
}
