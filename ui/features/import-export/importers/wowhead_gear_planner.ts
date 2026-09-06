import { nameToClass, nameToRace } from '@domain/proto_utils/names';
import { WOWHEAD_DOMAIN, WOWHEAD_GEAR_PLANNER_URL } from '@domain/wowhead';
import { Class, EquipmentSpec, Glyphs, ItemLevelState, ItemSlot, ItemSpec, Profession, Race } from '@generated/proto/common';
import i18n from '@i18n/config';

import { finishIndividualImport } from './finish_individual_import';
import type { ImporterDefinition } from './types';

const i = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// Taken from Wowhead
function readBits(e: number[]): number {
	if (!e.length) return 0;
	let t = 0,
		a = 1,
		n = e[0];
	while ((32 & n) > 0) {
		a++;
		n <<= 1;
	}
	const l = 63 >> a;
	let s = e.shift()! & l;
	a--;
	for (let n = 1; n <= a; n++) {
		t += 1 << (5 * n);
		s = (s << 6) | (e.shift() || 0);
	}
	return s + t;
}

interface WowheadGearPlannerImportJSON {
	classId: string;
	raceId: string;
	genderId: number;
	level: number;
	specIndex: number;
	talentString: string;
	glyphs: number[];
	items: {
		slotId: number;
		itemId: number;
		upgradeRank?: number;
		randomEnchantId?: number;
		reforge?: number;
		gemItemIds?: number[];
		enchantIds?: number[];
	}[];
}

// Taken from Wowhead
function readHash(e: string): WowheadGearPlannerImportJSON {
	const t: WowheadGearPlannerImportJSON = {
		classId: '',
		raceId: '',
		genderId: 0,
		level: 0,
		specIndex: 0,
		talentString: '',
		glyphs: [],
		items: [],
	};
	const s = /^([a-z-]+)\/([a-z-]+)(?:\/([a-zA-Z0-9_-]+))?$/.exec(e);
	if (!s) return t;

	t.classId = s[1];
	t.raceId = s[2];

	let d = s[3];
	if (!d) return t;
	const c = i.indexOf(d.substring(0, 1));
	if (((d = d.substring(1)), !d.length)) return t;
	const f: number[] = [];
	for (let e = 0; e < d.length; e++) f.push(i.indexOf(d.substring(e, e + 1)));
	if (c > 4) return t;
	if (c >= 2) {
		const _ = readBits(f);
	}
	{
		const e = readBits(f) - 1;
		e >= 0 && (t.genderId = e);
	}
	{
		const e = readBits(f);
		e && (t.level = e);
	}
	{
		c >= 4 && (t.specIndex = readBits(f));
		const e = [parseTalentString(f)];
		let n = readBits(f);
		for (; n-- > 0;) {
			const t = readBits(f);
			e.push(
				f
					.splice(0, t)
					.map(e => i[e])
					.join(''),
			);
		}
		const [talentString, glyphs] = e;
		t.talentString = talentString;
		t.glyphs = parseGlyphs(glyphs);
	}
	{
		let e = readBits(f);
		for (; e--;) {
			const e: any = {};
			let n = !1,
				s = !1,
				r = !1,
				l = 0,
				a = 0;
			switch (c) {
				case 0: {
					const e = f.shift();
					((n = 0 != ((e! >> 5) & 1)), (l = (e! >> 2) & 7), (a = 3 & e!));
					break;
				}
				case 1:
				case 2: {
					const e = readBits(f);
					((n = 0 != ((e >> 6) & 1)), (r = 0 != ((e >> 5) & 1)), (l = (e >> 2) & 7), (a = 3 & e));
					break;
				}
				default: {
					const e = readBits(f);
					((n = 0 != ((e >> 7) & 1)), (s = 0 != ((e >> 6) & 1)), (r = 0 != ((e >> 5) & 1)), (l = (e >> 2) & 7), (a = 3 & e));
					break;
				}
			}
			if (((e.slotId = readBits(f)), (e.itemId = readBits(f)), n)) {
				let t = readBits(f);
				const n = 1 & t;
				((t >>= 1), n && (t *= -1), (e.randomEnchantId = t));
			}
			for (s && (e.upgradeRank = readBits(f)), r && (e.reforge = readBits(f)); l--;) (e.gemItemIds ??= []).push(readBits(f));
			for (; a--;) (e.enchantIds ??= []).push(readBits(f));
			(t.items ??= []).push(e);
		}
	}
	return t;
}

function parseGlyphs(glyphStr: string): number[] {
	const glyphIds = Array(6).fill(0);
	if (!glyphStr) {
		return glyphIds;
	}
	const t = i.indexOf(glyphStr.substring(0, 1));
	const s = glyphStr.substring(1);
	if (!s.length) {
		return glyphIds;
	}
	if (t !== 0) {
		return glyphIds;
	}
	const a = [];
	for (let e = 0; e < s.length; e++) {
		a.push(i.indexOf(s.substring(e, e + 1)));
	}
	const l = 3 * i.length - 1;
	while (a.length > 1) {
		const e = readBits(a);
		const t = readBits(a);
		if (e > l) {
			continue;
		}
		glyphIds[e] = t;
	}

	return glyphIds;
}

function parseTalentString(e: number[]) {
	let t = '',
		n = readBits(e);
	for (; 0 !== n;) ((t += '' + (3 & n)), (n >>= 2));
	return t;
}

export function parseWowheadGearLink(link: string): WowheadGearPlannerImportJSON {
	const match = link.match(new RegExp(`${WOWHEAD_DOMAIN}/gear-planner/(.+)`));
	if (!match) {
		throw new Error(`Invalid WCL URL ${link}, must look like "${WOWHEAD_GEAR_PLANNER_URL}/CLASS/RACE/XXXX"`);
	}
	const e = match[1];
	return readHash(e);
}

export const WOWHEAD_SLOT_IDS: Record<ItemSlot, number> = {
	[ItemSlot.ItemSlotHead]: 1,
	[ItemSlot.ItemSlotNeck]: 2,
	[ItemSlot.ItemSlotShoulder]: 3,
	[ItemSlot.ItemSlotBack]: 15,
	[ItemSlot.ItemSlotChest]: 5,
	[ItemSlot.ItemSlotWrist]: 9,
	[ItemSlot.ItemSlotHands]: 10,
	[ItemSlot.ItemSlotWaist]: 6,
	[ItemSlot.ItemSlotLegs]: 7,
	[ItemSlot.ItemSlotFeet]: 8,
	[ItemSlot.ItemSlotFinger1]: 11,
	[ItemSlot.ItemSlotFinger2]: 12,
	[ItemSlot.ItemSlotTrinket1]: 13,
	[ItemSlot.ItemSlotTrinket2]: 14,
	[ItemSlot.ItemSlotMainHand]: 16,
	[ItemSlot.ItemSlotOffHand]: 17,
};

export const WOWHEAD_GEAR_PLANNER_IMPORTER: ImporterDefinition = {
	title: i18n.t('import.wowhead.title'),
	allowFileUpload: true,
	onImport: async (host, url) => {
		const match = url.match(new RegExp(`www\\.wowhead\\.com/${WOWHEAD_DOMAIN}/gear-planner/([a-z\\-]+)/([a-z\\-]+)/([a-zA-Z0-9_\\-]+)`));
		if (!match) {
			throw new Error(i18n.t('import.wowhead.error_invalid_url', { url }));
		}
		const missingItems: number[] = [];
		const missingEnchants: number[] = [];
		const professions: Profession[] = [];

		const parsed = parseWowheadGearLink(url);
		const glyphIds = parsed.glyphs;
		const charClass = nameToClass(parsed.classId.replaceAll('-', ''));
		if (charClass == Class.ClassUnknown) {
			throw new Error(i18n.t('import.wowhead.error_cannot_parse_class', { classId: parsed.classId }));
		}

		const converWowheadRace = (raceId: string): string => {
			const allianceSuffix = raceId.startsWith('alliance-') ? ' (A)' : undefined;
			const hordeSuffix = raceId.startsWith('horde-') ? ' (H)' : undefined;
			return raceId.replaceAll('alliance', '').replaceAll('horde', '').replaceAll('-', '') + (allianceSuffix ?? hordeSuffix ?? '');
		};

		const race = nameToRace(converWowheadRace(parsed.raceId));
		if (race == Race.RaceUnknown) {
			throw new Error(i18n.t('import.wowhead.error_cannot_parse_race', { raceId: parsed.raceId }));
		}

		const equipmentSpec = EquipmentSpec.create();

		parsed.items.forEach(item => {
			const dbItem = host.sim.db.getItemById(item.itemId);
			if (!dbItem) {
				missingItems.push(item.itemId);
				return;
			}
			const itemSpec = ItemSpec.create();
			itemSpec.id = item.itemId;
			const slotId = item.slotId;
			if (!!item.enchantIds?.length) {
				item.enchantIds.forEach(enchantSpellId => {
					const enchant = host.sim.db.enchantSpellIdToEnchant(enchantSpellId);
					const isTinker = enchant?.requiredProfession === Profession.Engineering;
					if (!enchant) {
						missingEnchants.push(enchantSpellId);
						return;
					}
					if (isTinker) {
						itemSpec.tinker = enchant.effectId;
						if (!professions.includes(Profession.Engineering)) {
							professions.push(Profession.Engineering);
						}
					} else {
						itemSpec.enchant = enchant.effectId;
					}
				});
			}
			if (item.gemItemIds) {
				itemSpec.gems = item.gemItemIds;
			}
			if (item.randomEnchantId) {
				itemSpec.randomSuffix = item.randomEnchantId;
			}
			if (item.reforge) {
				itemSpec.reforging = item.reforge;
			}
			if (item.upgradeRank && dbItem) {
				itemSpec.upgradeStep = dbItem.scalingOptions[item.upgradeRank]
					? (item.upgradeRank as ItemLevelState)
					: Object.keys(dbItem.scalingOptions).length - 2;
			}
			const itemSlotEntry = Object.entries(WOWHEAD_SLOT_IDS).find(e => e[1] == slotId);
			if (itemSlotEntry != null) {
				equipmentSpec.items.push(itemSpec);
			}
		});

		const glyphs = Glyphs.create({
			major1: host.sim.db.glyphSpellToItemId(glyphIds[0]),
			major2: host.sim.db.glyphSpellToItemId(glyphIds[1]),
			major3: host.sim.db.glyphSpellToItemId(glyphIds[2]),
			minor1: host.sim.db.glyphSpellToItemId(glyphIds[3]),
			minor2: host.sim.db.glyphSpellToItemId(glyphIds[4]),
			minor3: host.sim.db.glyphSpellToItemId(glyphIds[5]),
		});

		await finishIndividualImport(host, {
			charClass,
			race,
			equipmentSpec,
			talentsStr: parsed.talentString ?? '',
			glyphs,
			professions,
			missingEnchants,
			missingItems,
		});
	},
};
