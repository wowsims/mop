import { getLang } from '@i18n/locale_service';

import { CHARACTER_LEVEL } from './constants/mechanics';
import { Database } from './proto_utils/database';

export type WowheadTooltipItemParams = {
	/**
	 * @description Item ID
	 * @see item - mapped value from wowhead
	 * */
	itemId: number;
	/**
	 * @description Item level
	 * @see ilvl - mapped value from wowhead
	 * */
	itemLevel?: number;
	/**
	 * @description Level
	 * @see level - mapped value from wowhead
	 * */
	level?: number;
	/**
	 * @description Enchant
	 * @see ench - mapped value from wowhead
	 * */
	enchantIds?: number[];
	/**
	 * @description Gems
	 * @see gems - mapped value from wowhead
	 * */
	gemIds?: number[];
	/**
	 * @description Extra Socket
	 * @see sock - mapped value from wowhead
	 * */
	hasExtraSocket?: boolean;
	/**
	 * @description Item Set Pieces
	 * @see pcs - mapped value from wowhead
	 * */
	setPieceIds?: number[];
	/**
	 * @description Random Enchantment
	 * @see rand - mapped value from wowhead
	 * */
	randomEnchantmentId?: number;
	/**
	 * @description Reforges
	 * @see forg - mapped value from wowhead
	 * */
	reforgeId?: number;
	/**
	 * @description Upgrades
	 * @see upgd - mapped value from wowhead
	 * */
	upgradeStep?: number;
	/**
	 * @description Transmogrified to
	 * @see transmog - mapped value from wowhead
	 * */
	transmogId?: number;
};

export type WowheadTooltipSpellParams = {
	/**
	 * @description Spell ID
	 * @see spell - mapped value from wowhead
	 * */
	spellId: number;
	/**
	 * @description Level
	 * @see lvl - mapped value from wowhead
	 * */
	level?: number;
	/**
	 * @description Buff
	 * @see buff - mapped value from wowhead
	 * */
	useBuffAura?: boolean;
	/**
	 * @description Difficulty
	 * @see dd - mapped value from wowhead
	 * */
	difficultyId?: 14 | 15 | 16;
};

// Wowhead serves each expansion under its own url segment and its own `dataEnv`
// id. Porting this file to a sibling sim repo means changing the one line below:
// the domain, and every url built from it, follows. The literal-union key means
// an unmapped id is a compile error rather than a `.../undefined/...` url.
const WOWHEAD_DOMAINS = {
	5: 'tbc',
	15: 'mop-classic',
} as const;

export const WOWHEAD_EXPANSION_ENV: keyof typeof WOWHEAD_DOMAINS = 15;
export const WOWHEAD_DOMAIN = WOWHEAD_DOMAINS[WOWHEAD_EXPANSION_ENV];

export const buildWowheadTooltipDataset = async (options: WowheadTooltipItemParams | WowheadTooltipSpellParams) => {
	const lang = getLang();
	const params = new URLSearchParams();
	const langPrefix = lang && lang != 'en' ? lang + '.' : '';
	params.set('domain', `${langPrefix}${WOWHEAD_DOMAIN}`);
	params.set('dataEnv', String(WOWHEAD_EXPANSION_ENV));

	params.set('level', String(options.level || CHARACTER_LEVEL));

	if ('spellId' in options) {
		if (options.spellId) {
			params.set('spell', String(options.spellId));
		}
		if (options.useBuffAura) {
			const data = await Database.getSpellIconData(options.spellId);
			if (data.hasBuff) params.set('buff', '1');
		}
	}

	if ('itemId' in options) {
		params.set('item', String(options.itemId));
		if (options.itemLevel) {
			params.set('ilvl', String(options.itemLevel));
		}
		if (options.gemIds?.length) {
			params.set('gems', options.gemIds.join(':'));
		}
		if (options.enchantIds) {
			params.set('ench', options.enchantIds.join(':'));
		}
		if (options.reforgeId) {
			params.set('forg', String(options.reforgeId));
		}
		if (options.randomEnchantmentId) {
			params.set('rand', String(options.randomEnchantmentId));
		}
		if (typeof options.upgradeStep === 'number') {
			params.set('upgd', String(options.upgradeStep));
		}
		if (options.setPieceIds?.length) {
			params.set('pcs', options.setPieceIds.join(':'));
		}
		if (options.hasExtraSocket) {
			params.set('sock', '');
		}
		if (options.transmogId) {
			params.set('transmog', String(options.transmogId));
		}
	}

	return decodeURIComponent(params.toString());
};

export function getWowheadLanguagePrefix(): string {
	const lang = getLang();
	return lang === 'en' ? '' : `${lang}/`;
}

// Every wowhead link this app builds hangs off one of these. The entity links
// keep the bare host they have always used; the gear planner page is the `www.`
// form we show to users verbatim in the importer.
export const WOWHEAD_BASE_URL = `https://wowhead.com/${WOWHEAD_DOMAIN}`;
export const WOWHEAD_GEAR_PLANNER_URL = `https://www.wowhead.com/${WOWHEAD_DOMAIN}/gear-planner`;
export const WOWHEAD_ICON_BASE_URL = 'https://wow.zamimg.com/images/wow/icons';

type WowheadEntity = 'item' | 'spell' | 'quest' | 'npc' | 'zone';

// `https://wowhead.com/<domain>/<lang>/<entity>=<id>` — the language segment
// is empty for English.
export function wowheadEntityUrl(entity: WowheadEntity, id: number): string {
	return `${WOWHEAD_BASE_URL}/${getWowheadLanguagePrefix()}${entity}=${id}`;
}

export function wowheadIconUrl(iconLabel: string, size: 'large' | 'medium' | 'small' = 'large'): string {
	return `${WOWHEAD_ICON_BASE_URL}/${size}/${iconLabel}.jpg`;
}
