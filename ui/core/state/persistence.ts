// Settings persistence for individual sims: localStorage key derivation, the
// initial load sequence, and the autosave subscription — extracted from
// IndividualSimUI/SimUI so the load-order contract lives in the state layer.
//
// Load order is a contract; do not reorder:
//   defaults → saved localStorage settings → URL-hash link import (partial
//   imports keep the rest) → clear hash → default player name → subscribe
//   autosave LAST (so initialization doesn't re-store) → stat-weight settings.
import { SimSettingCategories } from '../constants/sim_settings';
import { Player } from '../player';
import { PlayerSpec } from '../player_spec';
import { PlayerSpecs } from '../player_specs';
import { IndividualSimSettings } from '../proto/ui';
import { batch, EventID, nextEventID } from '../state/batch';
import { tryParseUrlLocation } from './sim_links';
import { StatWeightActionSettings } from './stat_weight_settings';
import type { StoreSubscribe } from './subscriptions';
export const SETTINGS_STORAGE_SUFFIX = '__currentSettings__';
const AUTOSAVE_DEBOUNCE_MS = 300;
// Saved encounters deliberately skip the per-spec prefix so they are shared
// across all sims.
export const SHARED_SAVED_ENCOUNTER_STORAGE_KEY = 'sharedData__savedEncounter__';

// Local storage is shared by all sites under the same domain, so each spec
// site prefixes its keys.
export function getSpecStorageKey(playerSpec: PlayerSpec<any>, keyPart: string): string {
	return PlayerSpecs.getLocalStorageKey(playerSpec) + keyPart;
}

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
	const initEventID = nextEventID();
	// Declared before the batch: its flush can already schedule a persist.
	let persistTimer: ReturnType<typeof setTimeout> | null = null;
	batch(() => {
		host.applyDefaults(initEventID);

		const savedSettings = window.localStorage.getItem(opts.storageKey);
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
			const urlParseResults = tryParseUrlLocation(window.location);
			if (urlParseResults) {
				host.fromProto(initEventID, urlParseResults.settings, urlParseResults.categories);
			}
		} catch (e) {
			console.warn('Failed to parse link settings: ' + e);
		}
		window.location.hash = '';

		opts.player.setName(initEventID, 'Player');

		// This needs to go last so it doesn't re-store things as they are initialized.
		// Debounced: serializing + storing the full settings on every keystroke
		// cost ~50 ms per APL edit. A pending write is flushed on page hide.
		opts.autosaveSubscribe(schedulePersist);

		opts.statWeightSettings.load(initEventID);
	});

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
	window.addEventListener('pagehide', flushPersist);
	window.addEventListener('beforeunload', flushPersist);

	function persist() {
		const jsonStr = IndividualSimSettings.toJsonString(host.toProto());
		window.localStorage.setItem(opts.storageKey, jsonStr);
	}
}
