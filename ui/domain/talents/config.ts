// Shape of a class's talent tree and glyph catalogue, plus the builder that
// validates a generated tree JSON. Pure data: it used to live in the talents
// and glyphs pickers, which put a view module on ui/domain's import path.
// The pickers re-import these from here.

export type TalentsConfig<TalentsProto> = TalentTreeConfig<TalentsProto>;

export type TalentTreeConfig<TalentsProto> = {
	backgroundUrl: string;
	talents: Array<TalentConfig<TalentsProto>>;
};

export type TalentLocation = {
	// 0-indexed row in the tree
	rowIdx: number;
	// 0-indexed column in the tree
	colIdx: number;
};

export type TalentConfig<TalentsProto> = {
	fieldName: keyof TalentsProto | string;
	fancyName: string;
	location: TalentLocation;
	spellId: number;
};

export function newTalentsConfig<TalentsProto>(talentConfig: TalentsConfig<TalentsProto>): TalentsConfig<TalentsProto> {
	talentConfig.talents.forEach((talent, i) => {
		// Validate that talents are given in the correct order (left-to-right top-to-bottom).
		if (i != 0) {
			const prevTalent = talentConfig.talents[i - 1];
			if (
				talent.location.rowIdx < prevTalent.location.rowIdx ||
				(talent.location.rowIdx == prevTalent.location.rowIdx && talent.location.colIdx <= prevTalent.location.colIdx)
			) {
				throw new Error(`Out-of-order talent: ${String(talent.fancyName)}`);
			}
		}
	});

	return talentConfig;
}

export type GlyphConfig = {
	name: string;
	description: string;
	iconUrl: string;
};

export type GlyphsConfig = {
	majorGlyphs: Record<number, GlyphConfig>;
	minorGlyphs: Record<number, GlyphConfig>;
};
