// Settings persistence for individual sims: the initial load sequence and the
// autosave subscription — extracted from IndividualSimUI/SimUI so the
// load-order contract lives in the state layer. The localStorage key is built
// by the caller (IndividualSimUI.getStorageKey) and the browser surface comes
// in through the sim's `Env` adapter (state/env.ts).
//
// Load order is a contract; do not reorder:
//   defaults → saved localStorage settings → URL-hash link import (partial
//   imports keep the rest) → clear hash → default player name → subscribe
//   autosave LAST (so initialization doesn't re-store) → stat-weight settings.
import { IndividualSimSettings } from '@generated/proto/ui';

import type { SimSettingCategories } from '../constants/sim_settings';
import type { Player } from '../player';
import type { StatWeightActionSettings } from '../stat_weight_settings';
import { batch, EventID, nextEventID } from './batch';
import { tryParseUrlLocation } from './sim_links';
import type { StoreSubscribe } from './subscriptions';

export const SETTINGS_STORAGE_SUFFIX = '__currentSettings__';
const AUTOSAVE_DEBOUNCE_MS = 300;
// Saved encounters deliberately skip the per-spec prefix so they are shared
// across all sims.
export const SHARED_SAVED_ENCOUNTER_STORAGE_KEY = 'sharedData__savedEncounter__';

// The pieces of the sim UI the load sequence drives. toProto/fromProto are the
// (wrapper) envelope serializers; applyDefaults stays UI-owned.
export interface IndividualSettingsHost {
	applyDefaults(eventID: EventID): void;
	toProto(exportCategories?: Array<SimSettingCategories>): IndividualSimSettings;
	fromProto(eventID: EventID, settings: IndividualSimSettings, includeCategories?: Array<SimSettingCategories>): void;
}

export function loadIndividualSettings(
	host: IndividualSettingsHost,
	opts: {
		storageKey: string;
		player: Player<any>;
		// Store subscription whose fires trigger an autosave of the full envelope.
		autosaveSubscribe: StoreSubscribe;
		statWeightSettings: StatWeightActionSettings;
	},
) {
	const env = opts.player.sim.env;
	const initEventID = nextEventID();
	// Declared before the batch: its flush can already schedule a persist.
	let persistTimer: ReturnType<typeof setTimeout> | null = null;
	// The stats recompute is skipped for this batch; the stored settings already
	// carry the stats they were saved with (Sim.applyLoadedSettings).
	opts.player.sim.applyLoadedSettings(() =>
		batch(() => {
			host.applyDefaults(initEventID);

			const savedSettings = env.storage.getItem(opts.storageKey);
			if (savedSettings != null) {
				try {
					const settings = IndividualSimSettings.fromJsonString(savedSettings, { ignoreUnknownFields: true });
					host.fromProto(initEventID, settings);
				} catch (e) {
					console.warn('Failed to parse saved settings: ' + e);
				}
			}

			// Loading from link needs to happen after loading saved settings, so that partial link imports
			// (e.g. rotation only) include the previous settings for other categories.
			try {
				const urlParseResults = tryParseUrlLocation(env.location);
				if (urlParseResults) {
					host.fromProto(initEventID, urlParseResults.settings, urlParseResults.categories);
				}
			} catch (e) {
				console.warn('Failed to parse link settings: ' + e);
			}
			env.location.setHash('');

			opts.player.setName(initEventID, 'Player');

			// This needs to go last so it doesn't re-store things as they are initialized.
			// Debounced: serializing + storing the full settings on every keystroke
			// cost ~50 ms per APL edit. A pending write is flushed on page hide.
			opts.autosaveSubscribe(schedulePersist);

			opts.statWeightSettings.load(initEventID);
		}),
	);

	// The subscription above only sees changes made after it was registered,
	// so write once explicitly here (the old code saved once at the end of the
	// initial load too).
	persist();

	function schedulePersist() {
		if (persistTimer != null) clearTimeout(persistTimer);
		persistTimer = setTimeout(flushPersist, AUTOSAVE_DEBOUNCE_MS);
	}
	function flushPersist() {
		if (persistTimer == null) return;
		clearTimeout(persistTimer);
		persistTimer = null;
		persist();
	}
	env.onPageHide(flushPersist);

	function persist() {
		const jsonStr = IndividualSimSettings.toJsonString(host.toProto());
		env.storage.setItem(opts.storageKey, jsonStr);
	}
}
