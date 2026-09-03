import { GemColor, Profession, Stat } from '../proto/common.js';
import { UIGem as Gem } from '../proto/ui.js';
import { getEnumValues } from '../utils.js';

export const GEM_COLORS = (getEnumValues(GemColor) as Array<GemColor>).filter(color => color != GemColor.GemColorUnknown);
export const PRIMARY_COLORS = [GemColor.GemColorRed, GemColor.GemColorYellow, GemColor.GemColorBlue];
// Secondary is intentionally ordered so that it matches the inverse of PRIMARY_COLORS.
export const SECONDARY_COLORS = [GemColor.GemColorGreen, GemColor.GemColorPurple, GemColor.GemColorOrange];

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

export function gemMatchesStats(gem: Gem, statsToMatch: Stat[]) {
	return gem.stats.some((stat, statIdx) => stat > 0 && statsToMatch.includes(statIdx));
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
