import type { ItemSlot } from '@generated/proto/common';

import type { GearData, SelectorModalOpener, SelectorModalTabs } from '../types';

export interface SelectorModalRequest {
	slot: ItemSlot;
	tab: SelectorModalTabs;
	gearData: GearData;
	/** Bumped per call, so reopening the same slot on the same tab still resets the panes. */
	sequence: number;
}

/** The seam the vanilla side opens the gear modal through: `individual_sim_ui` holds this, `ItemPickerCell` opens through it, React subscribes. Same shape as `EpWeightsOpener`. */
export class GearSelectorModalOpener implements SelectorModalOpener {
	private request: SelectorModalRequest | null = null;
	private opened = false;
	private sequence = 0;
	private readonly listeners = new Set<() => void>();

	readonly subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	readonly getRequest = (): SelectorModalRequest | null => this.request;

	readonly isOpen = (): boolean => this.opened;

	readonly openTab = (slot: ItemSlot, tab: SelectorModalTabs, gearData: GearData): void => {
		this.sequence += 1;
		this.request = { slot, tab, gearData, sequence: this.sequence };
		this.opened = true;
		this.emit();
	};

	readonly setOpen = (open: boolean): void => {
		if (this.opened === open) return;
		this.opened = open;
		this.emit();
	};

	private emit() {
		for (const listener of this.listeners) listener();
	}
}
