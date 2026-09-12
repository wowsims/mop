import { GemColor, Profession } from '@generated/proto/common';
import { UIGem as Gem } from '@generated/proto/ui';

export const PRIMARY_COLORS = [GemColor.GemColorRed, GemColor.GemColorYellow, GemColor.GemColorBlue];
export const socketToMatchingColors = new Map<GemColor, Array<GemColor>>();
socketToMatchingColors.set(GemColor.GemColorMeta, [GemColor.GemColorMeta]);
socketToMatchingColors.set(GemColor.GemColorBlue, [GemColor.GemColorBlue, GemColor.GemColorPurple, GemColor.GemColorGreen, GemColor.GemColorPrismatic]);
socketToMatchingColors.set(GemColor.GemColorRed, [GemColor.GemColorRed, GemColor.GemColorPurple, GemColor.GemColorOrange, GemColor.GemColorPrismatic]);
socketToMatchingColors.set(GemColor.GemColorYellow, [GemColor.GemColorYellow, GemColor.GemColorOrange, GemColor.GemColorGreen, GemColor.GemColorPrismatic]);
socketToMatchingColors.set(GemColor.GemColorPrismatic, [
	GemColor.GemColorRed,
	GemColor.GemColorOrange,
	GemColor.GemColorYellow,
	GemColor.GemColorGreen,
	GemColor.GemColorBlue,
	GemColor.GemColorPurple,
	GemColor.GemColorPrismatic,
]);
socketToMatchingColors.set(GemColor.GemColorCogwheel, [GemColor.GemColorCogwheel]);
socketToMatchingColors.set(GemColor.GemColorShaTouched, [GemColor.GemColorShaTouched]);

export function gemColorMatchesSocket(gemColor: GemColor, socketColor: GemColor) {
	return gemColor == socketColor || (socketToMatchingColors.has(socketColor) && socketToMatchingColors.get(socketColor)!.includes(gemColor));
}

// Whether the gem matches the given socket color, for the purposes of gaining the socket bonuses.
export function gemMatchesSocket(gem: Gem, socketColor: GemColor) {
	return gemColorMatchesSocket(gem.color, socketColor);
}

// Whether the gem is capable of slotting into a socket of the given color.
export function gemEligibleForSocket(gem: Gem, socketColor: GemColor) {
	switch (socketColor) {
		case GemColor.GemColorMeta:
			return gem.color == GemColor.GemColorMeta;
		case GemColor.GemColorCogwheel:
			return gem.color == GemColor.GemColorCogwheel;
		case GemColor.GemColorShaTouched:
			return gem.color == GemColor.GemColorShaTouched;
		default:
			return gem.color != GemColor.GemColorMeta && gem.color != GemColor.GemColorCogwheel && gem.color != GemColor.GemColorShaTouched;
	}
}

export function isUnrestrictedGem(gem: Gem, phase?: number): boolean {
	return !gem.unique && gem.requiredProfession == Profession.ProfessionUnknown && (phase == null || gem.phase <= phase);
}
export class MetaGemCondition {
	readonly id: number;
	readonly description: string;

	readonly minRed: number;
	readonly minYellow: number;
	readonly minBlue: number;

	readonly compareColorGreater: GemColor;
	readonly compareColorLesser: GemColor;

	constructor(
		id: number,
		description: string,
		minRed: number,
		minYellow: number,
		minBlue: number,
		compareColorGreater: GemColor,
		compareColorLesser: GemColor,
	) {
		this.id = id;
		this.description = description;
		this.minRed = minRed;
		this.minYellow = minYellow;
		this.minBlue = minBlue;
		this.compareColorGreater = compareColorGreater;
		this.compareColorLesser = compareColorLesser;

		metaGemConditions.set(this.id, this);
	}

	// Whether the condition is met, i.e. the meta gem is activated.
	isMet(numRed: number, numYellow: number, numBlue: number): boolean {
		if (!(numRed >= this.minRed && numYellow >= this.minYellow && numBlue >= this.minBlue)) {
			return false;
		}

		if (this.compareColorGreater == GemColor.GemColorUnknown) {
			return true;
		}

		const numGreater = MetaGemCondition.getNumInCategory(this.compareColorGreater, numRed, numYellow, numBlue);
		const numLesser = MetaGemCondition.getNumInCategory(this.compareColorLesser, numRed, numYellow, numBlue);
		return numGreater > numLesser;
	}

	isCompareColorCondition(): boolean {
		return this.minRed == 0 && this.minYellow == 0 && this.minBlue == 0;
	}

	isOneOfEach(): boolean {
		return this.minRed == 1 && this.minYellow == 1 && this.minBlue == 1;
	}

	isTwoAndOne(): boolean {
		return [this.minRed, this.minYellow, this.minBlue].includes(2);
	}

	isThreeOfAColor(): boolean {
		return this.minRed == 3 || this.minYellow == 3 || this.minBlue == 3;
	}

	private static getNumInCategory(gemColor: GemColor, numRed: number, numYellow: number, numBlue: number): number {
		if (gemColor == GemColor.GemColorRed) {
			return numRed;
		} else if (gemColor == GemColor.GemColorYellow) {
			return numYellow;
		} else if (gemColor == GemColor.GemColorBlue) {
			return numBlue;
		} else {
			throw new Error('Invalid gem color for category check: ' + gemColor);
		}
	}

	static fromMinColors(id: number, description: string, minRed: number, minYellow: number, minBlue: number): MetaGemCondition {
		return new MetaGemCondition(id, description, minRed, minYellow, minBlue, GemColor.GemColorUnknown, GemColor.GemColorUnknown);
	}

	static fromCompareColors(id: number, description: string, compareColorGreater: GemColor, compareColorLesser: GemColor): MetaGemCondition {
		return new MetaGemCondition(id, description, 0, 0, 0, compareColorGreater, compareColorLesser);
	}
}

const metaGemConditions = new Map<number, MetaGemCondition>();

export function getMetaGemCondition(id: number): MetaGemCondition {
	//Commenting this because MoP meta gems has no requirements
	// if (!metaGemConditions.has(id)) {
	// 	throw new Error('Missing meta gem condition for gem: ' + id);
	// }

	return metaGemConditions.get(id)!;
}

export function isMetaGemActive(metaGem: Gem, numRed: number, numYellow: number, numBlue: number): boolean {
	return getMetaGemCondition(metaGem.id)?.isMet(numRed, numYellow, numBlue) ?? true;
}

export function getMetaGemConditionDescription(metaGem: Gem): string {
	return getMetaGemCondition(metaGem.id)?.description ?? '';
}
const emptyGemSocketIcons: Partial<Record<GemColor, string>> = {
	[GemColor.GemColorBlue]: 'https://wow.zamimg.com/images/icons/socket-blue.gif',
	[GemColor.GemColorMeta]: 'https://wow.zamimg.com/images/icons/socket-meta.gif',
	[GemColor.GemColorRed]: 'https://wow.zamimg.com/images/icons/socket-red.gif',
	[GemColor.GemColorYellow]: 'https://wow.zamimg.com/images/icons/socket-yellow.gif',
	[GemColor.GemColorPrismatic]: 'https://wow.zamimg.com/images/icons/socket-prismatic.gif',
	[GemColor.GemColorCogwheel]: 'https://wow.zamimg.com/images/icons/socket-cogwheel.gif',
	[GemColor.GemColorShaTouched]: 'https://wow.zamimg.com/images/icons/socket-hydraulic.gif',
};
export function getEmptyGemSocketIconUrl(color: GemColor): string {
	if (emptyGemSocketIcons[color]) return emptyGemSocketIcons[color] as string;

	throw new Error('No empty socket url for gem socket color: ' + color);
}
