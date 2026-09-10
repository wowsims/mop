// Facade over the bulk tab's store slice and its persisted settings blob, so the
// UI neither writes the store directly nor owns a localStorage key.
import { BulkSettings as BulkSettingsProto } from '@generated/proto/api';
import { ItemSlot } from '@generated/proto/common';

import { BulkSimItemSlot } from '../bulk/constants_auto_gen';
import type { Player } from '../player/player';
import type { Env } from '../state/env';
import { BulkSlice, patchKeyed, seedKeyed, SimStore } from '../state/sim_store';

const BULK_SETTINGS_STORAGE_KEY = 'bulk-settings.v2';
const LEGACY_BULK_SETTINGS_STORAGE_KEY = 'bulk-settings.v1';

const initialBulkSlice = (): BulkSlice => ({
	inheritUpgrades: true,
	useLegacyBulkSim: false,
	requiredSetBonuses: new Map(),
	frozenItems: new Map([
		[BulkSimItemSlot.ItemSlotFinger, null],
		[BulkSimItemSlot.ItemSlotTrinket, null],
	]),
	frozenWeaponSlot: undefined,
	weaponTypeFilters: new Map([
		[ItemSlot.ItemSlotMainHand, []],
		[ItemSlot.ItemSlotOffHand, []],
	]),
	combinations: 0,
	iterations: 0,
	combinationsPending: false,
	isRunning: false,
	started: false,
	results: null,
	v: { settings: 0, items: 0 },
});

export class BulkSettingsStore {
	private readonly env: Env;
	private readonly storageKey: string;
	private readonly legacyStorageKey: string;
	readonly store: SimStore;
	readonly storeKey: number;

	// `storagePrefix` is the per-spec localStorage prefix
	// (SimHostObject.getStorageKey('')).
	constructor(player: Player<any>, storagePrefix: string) {
		this.env = player.sim.env;
		this.storageKey = storagePrefix + BULK_SETTINGS_STORAGE_KEY;
		this.legacyStorageKey = storagePrefix + LEGACY_BULK_SETTINGS_STORAGE_KEY;
		this.store = player.sim.store;
		this.storeKey = player.storeKey;

		// Seed the slice before any subscriber exists (emit-less).
		seedKeyed(this.store, 'bulk', this.storeKey, initialBulkSlice());
	}

	get state(): BulkSlice {
		return this.store.getState().bulk[this.storeKey];
	}

	patch(patch: Partial<Omit<BulkSlice, 'v'>>, bumps: ReadonlyArray<keyof BulkSlice['v']> = []) {
		patchKeyed(this.store, 'bulk', this.storeKey, patch, bumps);
	}

	// Reads the persisted blob, dropping the v1 key on the way. Returns null
	// when nothing is stored, and empty defaults when the blob is unparseable.
	load(): BulkSettingsProto | null {
		this.env.storage.removeItem(this.legacyStorageKey);

		const stored = this.env.storage.getItem(this.storageKey);
		if (stored == null) return null;
		try {
			return BulkSettingsProto.fromJsonString(stored, { ignoreUnknownFields: true });
		} catch {
			return BulkSettingsProto.create();
		}
	}

	save(settings: BulkSettingsProto) {
		this.env.storage.setItem(this.storageKey, BulkSettingsProto.toJsonString(settings, { enumAsInteger: true }));
	}
}
