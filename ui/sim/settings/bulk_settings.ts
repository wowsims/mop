// The bulk tab's store slice and its persisted settings blob, so the UI neither writes the
// store directly nor owns a localStorage key. Everything is derived from the player: the slice
// is `bulk[player.storeKey]` and the key is the player's spec prefix.
import { BulkSettings as BulkSettingsProto } from '@generated/proto/api';
import { ItemSlot } from '@generated/proto/common';

import { BulkSimItemSlot } from '../bulk/constants_auto_gen';
import type { Player } from '../player/player';
import { BulkSlice, patchKeyed, seedKeyed } from '../state/sim_store';
import { specStorageKey } from '../state/storage_keys';

const BULK_SETTINGS_STORAGE_KEY = 'bulk-settings.v2';
const LEGACY_BULK_SETTINGS_STORAGE_KEY = 'bulk-settings.v1';

const initialBulkSlice = (): BulkSlice => ({
	items: [],
	pickerGroups: new Map(),
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
	runGear: null,
	v: { settings: 0, items: 0 },
});

// Seeds the slice before any subscriber exists (emit-less).
export const seedBulkSettings = (player: Player<any>) => seedKeyed(player.sim.store, 'bulk', player.storeKey, initialBulkSlice());

export const bulkState = (player: Player<any>): BulkSlice => player.sim.store.getState().bulk[player.storeKey];

// A bump with an empty patch is a bare emit; a patch with no bumps is a silent field write.
export const patchBulkState = (player: Player<any>, patch: Partial<Omit<BulkSlice, 'v'>>, bumps: ReadonlyArray<keyof BulkSlice['v']> = []) =>
	patchKeyed(player.sim.store, 'bulk', player.storeKey, patch, bumps);

// Reads the persisted blob, dropping the v1 key on the way. Returns null when
// nothing is stored, and empty defaults when the blob is unparseable.
export const loadStoredBulkSettings = (player: Player<any>): BulkSettingsProto | null => {
	const { storage } = player.sim.env;
	storage.removeItem(specStorageKey(player.getPlayerSpec(), LEGACY_BULK_SETTINGS_STORAGE_KEY));

	const stored = storage.getItem(specStorageKey(player.getPlayerSpec(), BULK_SETTINGS_STORAGE_KEY));
	if (stored == null) return null;
	try {
		return BulkSettingsProto.fromJsonString(stored, { ignoreUnknownFields: true });
	} catch {
		return BulkSettingsProto.create();
	}
};

export const storeBulkSettings = (player: Player<any>, settings: BulkSettingsProto) =>
	player.sim.env.storage.setItem(
		specStorageKey(player.getPlayerSpec(), BULK_SETTINGS_STORAGE_KEY),
		BulkSettingsProto.toJsonString(settings, { enumAsInteger: true }),
	);
