import type { PlayerSpec } from '../player/player_spec';
import { PlayerSpecs } from '../player/specs';

export const SAVED_GEAR_STORAGE_KEY = '__savedGear__';
export const SAVED_EP_WEIGHTS_STORAGE_KEY = '__savedEPWeights__';
export const SAVED_ROTATION_STORAGE_KEY = '__savedRotation__';
export const SAVED_SETTINGS_STORAGE_KEY = '__savedSettings__';
export const SAVED_TALENTS_STORAGE_KEY = '__savedTalents__';
export const STAT_WEIGHT_SETTINGS_STORAGE_KEY = '__statweight_settings__';

// Local storage is shared by all sites under the same domain, so each spec site prefixes its keys.
export function specStorageKey(spec: PlayerSpec<any>, keyPart: string): string {
	return PlayerSpecs.getLocalStorageKey(spec) + keyPart;
}
