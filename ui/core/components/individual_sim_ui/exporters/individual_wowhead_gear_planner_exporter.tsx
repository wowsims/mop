import { CHARACTER_LEVEL } from '@domain/constants/mechanics';
import { raceNames } from '@domain/proto_utils/names';
import { WOWHEAD_EXPANSION_ENV } from '@domain/wowhead';

import i18n from '../../../../i18n/config';
import { IndividualSimUI } from '../../../individual_sim_ui';
import { ItemSlot, Spec } from '../../../proto/common';
import { IndividualWowheadGearPlannerImporter } from '../importers';
import { IndividualExporter } from './individual_exporter';

const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function writeBits(value: number): number[] {
	let e = value;
	let t = 0;
	const bits: number[] = [];

	for (let a = 1; a <= 5; a++) {
		const n = 5 * a;
		if (e < 1 << n) {
			const nArray = [];
			while (nArray.length < a) {
				const t = e & 63;
				e >>= 6;
				nArray.unshift(t);
			}
			nArray[0] = nArray[0] | t;
			bits.push(...nArray);
			return bits;
		}
		e -= 1 << n;
		t = (64 | t) >> 1;
	}
	throw new Error('Value too large to encode.');
}

function writeTalents(talentStr: string): number[] {
	let t = 0;
	for (let n = talentStr.length - 1; n >= 0; n--) ((t <<= 2), (t |= 3 & Math.min(4, parseInt(talentStr.substring(n, n + 1)))));
	return writeBits(t);
}

// Function to write glyphs (reverse of parseGlyphs)
function writeGlyphs(glyphIds: number[]): string {
	const e = [0];
	Object.keys(glyphIds)
		.sort((e, t) => Number(e) - Number(t))
		.forEach(t => {
			const glyphId = glyphIds[Number(t)];
			if (!glyphId) return;
			e.push(...writeBits(parseInt(t)));
			e.push(...writeBits(glyphId));
		});
	let glyphStr = '';
	for (let s = 0; s < e.length; s++) {
		glyphStr += c.charAt(e[s]);
	}
	return glyphStr;
}

// Function to write the hash (reverse of readHash)
function writeHash(data: WowheadGearPlannerData): string {
	let hash = '';

	// Initialize bits array
	const bits: number[] = [4];

	// Write the expansion environment ID
	bits.push(...writeBits(WOWHEAD_EXPANSION_ENV));

	// Gender (assuming genderId is 1 or 2)
	bits.push(1);

	// Level
	bits.push(...writeBits(data.level ?? 0));

	// Spec Index
	bits.push(data.specIndex ?? 0);

	// Talents
	const talentBits = writeTalents(data.talents);
	bits.push(...talentBits);

	// Glyphs
	const glyphStr = [writeGlyphs(data.glyphs ?? [])];
	bits.push(...writeBits(glyphStr.length));
	glyphStr.forEach(e => {
		bits.push(...writeBits(e.length));
		bits.push(...e.split('').map(e => c.indexOf(e)));
	});

	// Items
	const items = data.items ?? [];
	bits.push(...writeBits(items.length));
	items.forEach(e => {
		let t = 0;
		const n = [];
		if ((n.push(...writeBits(e.slotId ?? 0)), n.push(...writeBits(e.itemId ?? 0)), (t <<= 1), e.randomEnchantId)) {
			t |= 1;
			let s = e.randomEnchantId;
			const r = s < 0 ? 1 : 0;
			(r && (s *= -1), (s <<= 1), (s |= r), n.push(...writeBits(s)));
		}
		((t <<= 1), e.upgradeRank && ((t |= 1), n.push(...writeBits(e.upgradeRank))), (t <<= 1), e.reforge && ((t |= 1), n.push(...writeBits(e.reforge))));
		const r: number[] = removeTrailingZeros((e.gemItemIds ?? []).slice(0, 8));
		((t <<= 3), (t |= r.length), r.forEach(e => n.push(...writeBits(e))));
		const l: number[] = removeTrailingZeros((e.enchantIds ?? []).slice(0, 4));
		((t <<= 2), (t |= l.length), l.forEach(e => n.push(...writeBits(e))), bits.push(...writeBits(t)), bits.push(...n));
	});

	// Encode bits into characters
	let hashData = '';
	for (let e = 0; e < bits.length; e++) hashData += c.charAt(bits[e]);

	// Append the hash data to the URL
	if (hashData) {
		hash += hashData;
	}

	return hash;
}

function removeTrailingZeros(arr: number[]): number[] {
	while (arr.length > 0 && arr[arr.length - 1] === 0) {
		arr.pop();
	}
	return arr;
}

export interface WowheadGearPlannerData {
	class?: string;
	race?: string;
	genderId?: number;
	specIndex?: number;
	level: number;
	talents: string;
	glyphs: number[];
	items: WowheadItemData[];
}

export interface WowheadItemData {
	slotId: number;
	itemId: number;
	randomEnchantId?: number;
	reforge?: number;
	upgradeRank?: number;
	gemItemIds?: number[];
	enchantIds?: number[];
}

export function createWowheadGearPlannerLink(data: WowheadGearPlannerData): string {
	const baseUrl = '';
	const hash = writeHash(data);
	return baseUrl + hash;
}

export class IndividualWowheadGearPlannerExporter<SpecType extends Spec> extends IndividualExporter<SpecType> {
	constructor(parent: HTMLElement, simUI: IndividualSimUI<SpecType>) {
		super(parent, simUI, { title: i18n.t('export.wowhead.title'), allowDownload: true });
		this.getData();
	}

	getData(): string {
		const player = this.simUI.player;

		const converWowheadRace = (raceName: string): string => {
			const alliancePrefix = raceName.endsWith('(A)') ? 'alliance-' : undefined;
			const hordePrefix = raceName.endsWith('(H)') ? 'horde-' : undefined;
			return (alliancePrefix ?? hordePrefix ?? '') + raceName.replaceAll(' (A)', '').replaceAll(' (H)', '').replaceAll(/\s/g, '-').toLowerCase();
		};

		const classStr = player.getPlayerClass().friendlyName.replaceAll(/\s/g, '-').toLowerCase();
		const raceStr = converWowheadRace(raceNames.get(player.getRace())!);
		const url = `https://www.wowhead.com/mop-classic/gear-planner/${classStr}/${raceStr}/`;

		const addGlyph = (glyphItemId: number): number => {
			const spellId = this.simUI.sim.db.glyphItemToSpellId(glyphItemId);
			if (!spellId) {
				return 0;
			}
			return spellId;
		};

		const glyphs = player.getGlyphs();

		const data: WowheadGearPlannerData = {
			level: CHARACTER_LEVEL,
			specIndex: player.getPlayerSpec().specIndex,
			talents: player.getTalentsString(),
			glyphs: [
				addGlyph(glyphs.major1),
				addGlyph(glyphs.major2),
				addGlyph(glyphs.major3),
				addGlyph(glyphs.minor1),
				addGlyph(glyphs.minor2),
				addGlyph(glyphs.minor3),
			],
			items: [],
		};

		const gear = player.getGear();

		gear.getItemSlots()
			.sort((slot1, slot2) => IndividualWowheadGearPlannerImporter.slotIDs[slot1] - IndividualWowheadGearPlannerImporter.slotIDs[slot2])
			.forEach(itemSlot => {
				const item = gear.getEquippedItem(itemSlot);
				if (!item) {
					return;
				}

				const slotId = IndividualWowheadGearPlannerImporter.slotIDs[itemSlot];
				const itemData = {
					slotId: slotId,
					itemId: item.id,
				} as WowheadItemData;
				if (item._randomSuffix?.id) {
					itemData.randomEnchantId = item._randomSuffix.id;
				}
				itemData.enchantIds = [];
				if (item._enchant?.spellId) {
					itemData.enchantIds.push(item._enchant.spellId);
				}
				if (item._tinker?.spellId) {
					itemData.enchantIds.push(item._tinker.spellId);
				}

				if (ItemSlot.ItemSlotHands == itemSlot) {
					//Todo: IF Hands we want to append any tinkers if existing
				}

				if (item._gems) {
					itemData.gemItemIds = item._gems.map(gem => {
						return gem?.id ?? 0;
					});
				}
				if (item._reforge) {
					itemData.reforge = item._reforge.id;
				}
				if (item._upgrade > 0) {
					itemData.upgradeRank = item._upgrade;
				}
				data.items.push(itemData);
			});

		const hash = createWowheadGearPlannerLink(data);

		return url + hash;
	}
}
