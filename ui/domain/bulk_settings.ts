// Facade over the bulk tab's store slice and its persisted settings blob —
// extracted from components/individual_sim_ui/bulk_tab.tsx so the UI neither
// writes the store directly nor owns a localStorage key.
//
// The slice holds version counters only: the values themselves stay on the tab
// (nothing reads them from the store), so `touch` is the tab's one write path.
import { BulkSettings as BulkSettingsProto } from '@generated/proto/api';

import type { Player } from './player';
import type { Env } from './state/env';
import { patchKeyed, seedKeyed, SimStore } from './state/sim_store';

const BULK_SETTINGS_STORAGE_KEY = 'bulk-settings.v2';
const LEGACY_BULK_SETTINGS_STORAGE_KEY = 'bulk-settings.v1';

export class BulkSettingsStore {
	private readonly env: Env;
	private readonly storageKey: string;
	private readonly legacyStorageKey: string;
	readonly store: SimStore;
	readonly storeKey: number;

	// `storagePrefix` is the per-spec localStorage prefix
	// (IndividualSimUI.getStorageKey('')).
	constructor(player: Player<any>, storagePrefix: string) {
		this.env = player.sim.env;
		this.storageKey = storagePrefix + BULK_SETTINGS_STORAGE_KEY;
		this.legacyStorageKey = storagePrefix + LEGACY_BULK_SETTINGS_STORAGE_KEY;
		this.store = player.sim.store;
		this.storeKey = player.storeKey;

		// Seed the slice before any subscriber exists (emit-less).
		seedKeyed(this.store, 'bulk', this.storeKey, { v: { settings: 0, items: 0 } });
	}

	// Bumps a version counter — where the tab used to emit.
	touch(field: 'settings' | 'items') {
		patchKeyed(this.store, 'bulk', this.storeKey, {}, [field]);
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
