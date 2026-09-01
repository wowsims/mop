import { Player } from '../player';
import { ItemSlot, ItemSpec, ItemSwap } from '../proto/common';
import { EquippedItem } from '../proto_utils/equipped_item';
import { ItemSwapGear } from '../proto_utils/gear';
import { Stats } from '../proto_utils/stats';
import { EventID, TypedEvent } from '../typed_event';

export class ItemSwapSettings {
	private readonly player: Player<any>;
	readonly changeEmitter = new TypedEvent<void>('PlayerItemSwap');

	private enableItemSwap = false;
	private gear = new ItemSwapGear({});
	private bonusStats = new Stats();

	constructor(player: Player<any>) {
		this.player = player;
	}

	setItemSwapSettings(eventID: EventID, enableItemSwap: boolean, gear: ItemSwapGear, bonusStats?: Stats) {
		this.enableItemSwap = enableItemSwap;
		this.gear = gear;
		this.bonusStats = bonusStats || new Stats();

		this.changeEmitter.emit(eventID);
	}

	setBonusStats(eventID: EventID, stats: Stats) {
		this.bonusStats = stats;
		this.changeEmitter.emit(eventID);
	}

	getBonusStats() {
		return this.bonusStats;
	}

	getEnableItemSwap(): boolean {
		return this.enableItemSwap;
	}

	setEnableItemSwap(eventID: EventID, newEnableItemSwap: boolean) {
		if (newEnableItemSwap == this.enableItemSwap) return;

		this.enableItemSwap = newEnableItemSwap;
		this.changeEmitter.emit(eventID);
	}

	equipItem(eventID: EventID, slot: ItemSlot, newItem: EquippedItem | null) {
		this.setGear(eventID, this.gear.withEquippedItem(slot, newItem, this.player.canDualWield2H()));
	}

	getItem(slot: ItemSlot): EquippedItem | null {
		return this.gear.getEquippedItem(slot);
	}

	getGear(): ItemSwapGear {
		return this.gear;
	}

	setGear(eventID: EventID, newItemSwapGear: ItemSwapGear) {
		if (newItemSwapGear.equals(this.gear)) return;

		this.gear = newItemSwapGear;
		this.changeEmitter.emit(eventID);
	}

	toProto(): ItemSwap {
		return ItemSwap.create({
			prepullBonusStats: this.bonusStats.toProto(),
			items: this.gear.asArray().map(ei => (ei ? ei.asSpec() : ItemSpec.create())),
		});
	}
}
