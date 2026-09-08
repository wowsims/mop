import { stringComparator } from '@sim/utils/collections';
import type { Player } from '@sim/player/player';
import { ActionId } from '@sim/proto_utils/action_id';
import type { Database } from '@sim/proto_utils/database';
import { subscribePlayerField } from '@sim/state/subscriptions';
import type { GlyphsConfig } from '@sim/talents/config';
import { type Class, type Glyphs, ItemQuality } from '@generated/proto/common';
import i18n from '@i18n/config';
import { getClassI18nKey } from '@i18n/entity_mapping';
import type { InputConfig } from '@ui-kit/input';

export interface GlyphData {
	id: number;
	name: string;
	description: string;
	iconUrl: string;
	quality: ItemQuality | null;
	spellId: number;
}

export enum GlyphKind {
	Major = 'major',
	Minor = 'minor',
}

export const majorGlyphFields = ['major1', 'major2', 'major3'] as const;
export const minorGlyphFields = ['minor1', 'minor2', 'minor3'] as const;

export type GlyphField = (typeof majorGlyphFields)[number] | (typeof minorGlyphFields)[number];

export const emptyGlyphData: GlyphData = {
	id: 0,
	name: i18n.t('talents_tab.glyphs.empty'),
	description: '',
	iconUrl: 'https://wow.zamimg.com/images/wow/icons/medium/inventoryslot_empty.jpg',
	quality: null,
	spellId: 0,
};

export const glyphData = (glyphsConfig: GlyphsConfig, playerClass: Class, glyph: number, db: Database): GlyphData => {
	const glyphType: GlyphKind = glyphsConfig.majorGlyphs[glyph] ? GlyphKind.Major : GlyphKind.Minor;
	const glyphConfig = glyphType === GlyphKind.Major ? glyphsConfig.majorGlyphs[glyph] : glyphsConfig.minorGlyphs[glyph];
	const translationKey = `${getClassI18nKey(playerClass)}.${glyphType}.${glyphConfig.name
		.toLowerCase()
		.replace(/[':]/g, '')
		.replace(/[\s-]+/g, '_')}`;

	return {
		id: glyph,
		name: i18n.t(`${translationKey}.name`, { ns: 'glyphs' }),
		description: i18n.t(`${translationKey}.description`, { ns: 'glyphs' }),
		iconUrl: glyphConfig.iconUrl,
		quality: ItemQuality.ItemQualityCommon,
		spellId: db.glyphItemToSpellId(glyph),
	};
};

export const buildGlyphOptions = (glyphsConfig: GlyphsConfig, kind: GlyphKind, playerClass: Class, db: Database): GlyphData[] =>
	Object.keys(kind === GlyphKind.Major ? glyphsConfig.majorGlyphs : glyphsConfig.minorGlyphs)
		.map(idStr => glyphData(glyphsConfig, playerClass, Number(idStr), db))
		.sort((a, b) => stringComparator(a.name, b.name));

export const glyphUrl = (glyph: GlyphData) => (glyph.spellId ? ActionId.makeSpellUrl(glyph.spellId) : ActionId.makeItemUrl(glyph.id));

export const glyphTooltipData = (glyph: GlyphData) => (glyph.spellId ? ActionId.makeSpellTooltipData(glyph.spellId) : ActionId.makeItemTooltipData(glyph.id));

export const matchesGlyphSearch = (name: string, search: string) =>
	search.length === 0 ||
	search
		.toLowerCase()
		.split(' ')
		.every(word => name.toLowerCase().includes(word));

export const setGlyph = (player: Player<any>, field: GlyphField, id: number) => {
	const glyphs = player.getGlyphs();
	(glyphs[field] as number) = id;
	player.setGlyphs(glyphs);
};

export const readGlyph = (player: Player<any>, field: GlyphField) => player.getGlyphs()[field] as number;

export const glyphOfField = (glyphs: Glyphs, field: GlyphField) => glyphs[field] as number;

export const glyphInputConfig = (field: GlyphField): InputConfig<Player<any>, number> & { id: string } => ({
	id: `glyph-picker-glyph-${field}`,
	inline: true,
	extraCssClasses: ['item-picker-root'],
	storeSubscribe: (player: Player<any>) => subscribePlayerField(player, 'glyphs'),
	getValue: (player: Player<any>) => readGlyph(player, field),
	setValue: (player: Player<any>, newValue: number) => setGlyph(player, field, newValue),
});
