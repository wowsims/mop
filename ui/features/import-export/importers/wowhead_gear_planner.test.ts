// The gear-planner hash is Wowhead's own format, moved verbatim from the vanilla importer. Nothing
// about it is readable, so the test that means anything is a round trip: the *exporter* beside it
// carries an independent writer (`writeBits`/`writeHash`), and every field the reader recovers has
// to come back out of what the writer put in.
import { WOWHEAD_DOMAIN } from '@domain/wowhead';
import { describe, expect, it } from 'vitest';

import { createWowheadGearPlannerLink, type WowheadGearPlannerData } from '../exporters/wowhead_gear_planner';
import { parseWowheadGearLink } from './wowhead_gear_planner';

const link = (data: WowheadGearPlannerData, classId = 'warrior', raceId = 'human') =>
	`https://www.wowhead.com/${WOWHEAD_DOMAIN}/gear-planner/${classId}/${raceId}/${createWowheadGearPlannerLink(data)}`;

describe('parseWowheadGearLink', () => {
	it('recovers class and race from the path', () => {
		const parsed = parseWowheadGearLink(link({ level: 90, specIndex: 0, talents: '', glyphs: [], items: [] }, 'death-knight', 'horde-blood-elf'));
		expect(parsed.classId).toBe('death-knight');
		expect(parsed.raceId).toBe('horde-blood-elf');
	});

	it('round-trips the talent string, the level and the spec index', () => {
		const parsed = parseWowheadGearLink(link({ level: 90, specIndex: 2, talents: '312231', glyphs: [], items: [] }));
		expect(parsed.talentString).toBe('312231');
		expect(parsed.level).toBe(90);
		expect(parsed.specIndex).toBe(2);
	});

	it('round-trips all six glyph spell ids, in order', () => {
		const glyphs = [58095, 58367, 63324, 58368, 63325, 43427];
		const parsed = parseWowheadGearLink(link({ level: 90, specIndex: 0, talents: '111111', glyphs, items: [] }));
		expect(parsed.glyphs).toEqual(glyphs);
	});

	// A glyph slot the character has not filled is a 0, and the six-slot shape has to survive it —
	// the importer indexes `glyphIds[0..5]` positionally into `Glyphs.create`.
	it('keeps empty glyph slots in place', () => {
		const glyphs = [0, 58367, 0, 0, 0, 43427];
		const parsed = parseWowheadGearLink(link({ level: 90, specIndex: 0, talents: '111111', glyphs, items: [] }));
		expect(parsed.glyphs).toEqual(glyphs);
	});

	it('round-trips an item with every optional field set', () => {
		const item = {
			slotId: 1,
			itemId: 86885,
			randomEnchantId: 5121,
			reforge: 148,
			upgradeRank: 2,
			gemItemIds: [76884, 76885],
			enchantIds: [104395, 96245],
		};
		const parsed = parseWowheadGearLink(link({ level: 90, specIndex: 0, talents: '111111', glyphs: [], items: [item] }));
		expect(parsed.items).toEqual([item]);
	});

	it('round-trips a bare item, leaving the optional fields off', () => {
		const parsed = parseWowheadGearLink(
			link({ level: 90, specIndex: 0, talents: '111111', glyphs: [], items: [{ slotId: 16, itemId: 87172, gemItemIds: [], enchantIds: [] }] }),
		);
		expect(parsed.items).toEqual([{ slotId: 16, itemId: 87172 }]);
	});

	it('round-trips a full sixteen-slot set', () => {
		const items = Array.from({ length: 16 }, (_, index) => ({ slotId: index + 1, itemId: 80000 + index * 37, gemItemIds: [], enchantIds: [] }));
		const parsed = parseWowheadGearLink(link({ level: 90, specIndex: 0, talents: '111111', glyphs: [], items }));
		expect(parsed.items.map(item => [item.slotId, item.itemId])).toEqual(items.map(item => [item.slotId, item.itemId]));
	});

	it('rejects a link that is not a gear planner link', () => {
		expect(() => parseWowheadGearLink('https://www.wowhead.com/item=86885')).toThrow(/Invalid WCL URL/);
	});
});
