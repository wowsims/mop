import type { Player } from './player';
import { ItemSlot, ItemSpec, ItemSwap } from './proto/common';
import { EquippedItem } from './proto_utils/equipped_item';
import { ItemSwapGear } from './proto_utils/gear';
import { Stats } from './proto_utils/stats';
import { EventID } from './state/batch';
// Facade over the player's itemSwap* store fields (one shared `itemSwap`
// version counter, see Player.patchItemSwap).
export class ItemSwapSettings {
	private readonly player: Player<any>;

	constructor(player: Player<any>) {
		this.player = player;
	}

	setItemSwapSettings(eventID: EventID, enableItemSwap: boolean, gear: ItemSwapGear, bonusStats?: Stats) {
		this.player.patchItemSwap(eventID, { itemSwapEnabled: enableItemSwap, itemSwapGear: gear, itemSwapBonusStats: bonusStats || new Stats() });
	}

	setBonusStats(eventID: EventID, stats: Stats) {
		this.player.patchItemSwap(eventID, { itemSwapBonusStats: stats });
	}

	getBonusStats(): Stats {
		return this.player.getItemSwapField('itemSwapBonusStats');
	}

	getEnableItemSwap(): boolean {
		return this.player.getItemSwapField('itemSwapEnabled');
	}

	setEnableItemSwap(eventID: EventID, newEnableItemSwap: boolean) {
		if (newEnableItemSwap == this.getEnableItemSwap()) return;
		this.player.patchItemSwap(eventID, { itemSwapEnabled: newEnableItemSwap });
	}

	equipItem(eventID: EventID, slot: ItemSlot, newItem: EquippedItem | null) {
		this.setGear(eventID, this.getGear().withEquippedItem(slot, newItem, this.player.canDualWield2H()));
	}

	getItem(slot: ItemSlot): EquippedItem | null {
		return this.getGear().getEquippedItem(slot);
	}

	getGear(): ItemSwapGear {
		return this.player.getItemSwapField('itemSwapGear');
	}

	setGear(eventID: EventID, newItemSwapGear: ItemSwapGear) {
		if (newItemSwapGear.equals(this.getGear())) return;
		this.player.patchItemSwap(eventID, { itemSwapGear: newItemSwapGear });
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
