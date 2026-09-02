// URL-hash link parsing for individual sim settings, extracted from
// IndividualLinkImporter so domain code (reforge_cache) can use it without
// depending on ui/core/components.
import pako from 'pako';

import { SIM_CATEGORY_KEYS, SimSettingCategories } from '../constants/sim_settings';
import { IndividualSimSettings } from '../proto/ui';
import { getEnumValues } from '../utils';

export const LINK_CATEGORY_PARAM = 'i';
export const LINK_DEFAULT_CATEGORIES = getEnumValues(SimSettingCategories).filter(c => c != SimSettingCategories.UISettings) as Array<SimSettingCategories>;

export interface UrlParseData {
	settings: IndividualSimSettings;
	categories: Array<SimSettingCategories>;
}

// Structural subset of `Location` / `URL` / `Env['location']`.
export interface UrlLocation {
	readonly hash: string;
	readonly search: string;
}

// `loc` is any location-shaped source: `sim.env.location`, `window.location`
// or a parsed `URL`.
export function tryParseUrlLocation(loc: UrlLocation): UrlParseData | null {
	let hash = loc.hash;
	if (hash.length <= 1) {
		return null;
	}

	// Remove leading '#'
	hash = hash.substring(1);
	const binary = atob(hash);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}

	const settingsBytes = pako.inflate(bytes);
	const settings = IndividualSimSettings.fromBinary(settingsBytes);

	let exportCategories = LINK_DEFAULT_CATEGORIES;
	const urlParams = new URLSearchParams(loc.search);
	if (urlParams.has(LINK_CATEGORY_PARAM)) {
		const categoryChars = urlParams.get(LINK_CATEGORY_PARAM)!.split('');
		exportCategories = categoryChars
			.map(char => [...SIM_CATEGORY_KEYS.entries()].find(e => e[1] == char))
			.filter(e => e)
			.map(e => e![0]);
	}

	return {
		settings: settings,
		categories: exportCategories,
	};
}
