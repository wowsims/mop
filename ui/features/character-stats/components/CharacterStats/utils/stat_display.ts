import * as Mechanics from '@domain/constants/mechanics';
import { Player } from '@domain/player';
import { Stats, UnitStat } from '@domain/proto_utils/stats';
import { ItemSlot, Race, Spec, Stat, WeaponType } from '@generated/proto/common';
import i18n from '@i18n/config';

export interface RacialBonuses {
	/** Draenei: the racial hit is baked into the rating, and is subtracted before it is shown. */
	hasRacialHitBonus: boolean;
	activeRacialExpertiseBonuses: boolean[];
}

export const readRacialBonuses = (player: Player<any>): RacialBonuses => ({
	hasRacialHitBonus: player.getRace() === Race.RaceDraenei,
	activeRacialExpertiseBonuses: player.getActiveRacialExpertiseBonuses(),
});

export const statDisplayString = (player: Player<any>, racial: RacialBonuses, deltaStats: Stats, unitStat: UnitStat, includeBase?: boolean): string => {
	const rootStat = unitStat.hasRootStat() ? unitStat.getRootStat() : null;
	let rootRatingValue = rootStat !== null ? deltaStats.getStat(rootStat) : null;
	let derivedPercentOrPointsValue = unitStat.convertDefaultUnitsToPercent(deltaStats.getUnitStat(unitStat));
	const percentOrPointsSuffix = unitStat.equalsStat(Stat.StatMasteryRating)
		? ` ${i18n.t('sidebar.character_stats.points_suffix')}`
		: i18n.t('sidebar.character_stats.percent_suffix');

	if (unitStat.equalsStat(Stat.StatMasteryRating) && includeBase) {
		derivedPercentOrPointsValue = derivedPercentOrPointsValue! + player.getBaseMastery();
	} else if (rootStat === Stat.StatHitRating && includeBase && racial.hasRacialHitBonus) {
		if (rootRatingValue !== null && rootRatingValue > 0) {
			rootRatingValue -= Mechanics.PHYSICAL_HIT_RATING_PER_HIT_PERCENT;
		}
	} else if (unitStat.equalsStat(Stat.StatExpertiseRating) && includeBase) {
		const [mhWeaponExpertiseActive, ohWeaponExpertiseActive] = racial.activeRacialExpertiseBonuses;
		if (rootRatingValue !== null && rootRatingValue > 0 && mhWeaponExpertiseActive) {
			rootRatingValue -= Mechanics.EXPERTISE_PER_QUARTER_PERCENT_REDUCTION * 4;
		}

		const matchesBothHands = mhWeaponExpertiseActive && ohWeaponExpertiseActive;
		const offHand = player.getEquippedItem(ItemSlot.ItemSlotOffHand);
		if (
			!matchesBothHands &&
			(mhWeaponExpertiseActive || ohWeaponExpertiseActive) &&
			offHand !== null &&
			offHand.item.weaponType !== WeaponType.WeaponTypeShield &&
			offHand.item.weaponType !== WeaponType.WeaponTypeOffHand
		) {
			const hideRootRating = rootRatingValue === null || (rootRatingValue === 0 && derivedPercentOrPointsValue !== null);
			const rootRatingString = hideRootRating ? '' : String(Math.round(rootRatingValue!));
			const mhPercentString = `${derivedPercentOrPointsValue!.toFixed(2)}` + percentOrPointsSuffix;
			const ohPercentValue = derivedPercentOrPointsValue! + (ohWeaponExpertiseActive ? 1 : -1);
			const ohPercentString = `${ohPercentValue.toFixed(2)}` + percentOrPointsSuffix;
			const wrappedPercentString = hideRootRating ? `${mhPercentString} / ${ohPercentString}` : ` (${mhPercentString} / ${ohPercentString})`;
			return rootRatingString + wrappedPercentString;
		}
	}

	const hideRootRating = rootRatingValue === null || (rootRatingValue === 0 && derivedPercentOrPointsValue !== null);
	const rootRatingString = hideRootRating ? '' : String(Math.round(rootRatingValue!));
	const percentOrPointsString = derivedPercentOrPointsValue === null ? '' : `${derivedPercentOrPointsValue.toFixed(2)}` + percentOrPointsSuffix;
	const wrappedPercentOrPointsString = hideRootRating || derivedPercentOrPointsValue === null ? percentOrPointsString : ` (${percentOrPointsString})`;
	return rootRatingString + wrappedPercentOrPointsString;
};

export const shouldShowMeleeCritCap = (player: Player<any>): boolean => player.getPlayerSpec().isMeleeDpsSpec;

export const meleeCritCapDisplayString = (player: Player<any>): string => {
	const playerCritCapDelta = player.getMeleeCritCap();

	if (playerCritCapDelta === 0.0) {
		return i18n.t('sidebar.character_stats.crit_cap.exact');
	}

	const prefix = playerCritCapDelta > 0 ? i18n.t('sidebar.character_stats.crit_cap.over_by') : i18n.t('sidebar.character_stats.crit_cap.under_by');
	return `${prefix} ${Math.abs(playerCritCapDelta).toFixed(2)}%`;
};

/** Warlock and Protection Warrior scale mastery twice, off a different base. */
export const masteryScaling = (player: Player<any>): { modifiers: number[]; customBonus: number[] } => {
	let modifiers = [player.getMasteryPerPointModifier()];
	let customBonus = [0];
	switch (player.getSpec()) {
		case Spec.SpecDestructionWarlock:
			customBonus = [1, 0];
			modifiers = [1, ...modifiers];
			break;
		case Spec.SpecDemonologyWarlock:
			customBonus = [0, 0];
			modifiers = [1, ...modifiers];
			break;
		case Spec.SpecProtectionWarrior:
			customBonus = [0, 0];
			modifiers = [0.5, ...modifiers];
			break;
		case Spec.SpecWindwalkerMonk:
			customBonus = [3.5, 0];
			break;
		case Spec.SpecBalanceDruid:
			customBonus = [15.0];
			break;
	}
	return { modifiers, customBonus };
};

export const bonusStatClass = (bonusStatValue: number): string => (bonusStatValue === 0 ? 'text-white' : bonusStatValue > 0 ? 'text-success' : 'text-danger');

/** The crit cap reads the other way round: over the cap is bad. */
export const critCapClass = (capDelta: number): string => (capDelta === 0 ? 'text-white' : capDelta > 0 ? 'text-danger' : 'text-success');
