import { HandType, ItemSlot } from '@generated/proto/common';
import i18n from '@i18n/config';
import type { Player } from '@sim/player/player';
import { armorTypeNames, professionNames } from '@sim/proto/names';
import { getTalentPoints } from '@sim/proto/utils';
import type { SimWarning } from '@sim/sim_host';
import type { IndividualSimUIConfig } from '@sim/spec_config';
import { subscribeAll, subscribePlayerField } from '@sim/state/subscriptions';
import { getMissingTalentRows, getRequiredTalentRows, hasRequiredTalents } from '@sim/talents/requirements';

export function defaultSimWarnings<SpecType extends number>(player: Player<SpecType>, config: IndividualSimUIConfig<SpecType>): Array<SimWarning> {
	return [
		{
			updateOn: subscribeAll([
				subscribePlayerField(player, 'gear'),
				subscribePlayerField(player, 'profession1'),
				subscribePlayerField(player, 'profession2'),
			]),
			getContent: () => {
				const failedProfReqs = player.getGear().getFailedProfessionRequirements(player.getProfessions());
				if (failedProfReqs.length == 0) {
					return '';
				}

				return failedProfReqs.map(fpr =>
					i18n.t('sidebar.warnings.profession_requirement', {
						itemName: fpr.name,
						professionName: professionNames.get(fpr.requiredProfession)!,
					}),
				);
			},
		},
		{
			updateOn: subscribePlayerField(player, 'gear'),
			getContent: () => {
				const jcGems = player.getGear().getJCGems(player.isBlacksmithing());
				if (jcGems.length <= 2) {
					return '';
				}

				return i18n.t('sidebar.warnings.too_many_jc_gems', {
					count: jcGems.length,
				});
			},
		},
		{
			updateOn: subscribePlayerField(player, 'talentsString'),
			getContent: () => {
				const talentPoints = getTalentPoints(player.getTalentsString());
				const requiredRows = getRequiredTalentRows(config);

				// Only skip warning during initial load if there are no required talents
				if (talentPoints == 0 && requiredRows.length == 0) {
					return '';
				} else if (!hasRequiredTalents(config, player.getTalentsString())) {
					const missingRows = getMissingTalentRows(config, player.getTalentsString());
					const missingRowNumbers = missingRows.map(row => row + 1).join(', ');
					return i18n.t('sidebar.warnings.unspent_talent_points', {
						rowNumbers: missingRowNumbers,
					});
				} else {
					return '';
				}
			},
		},
		{
			updateOn: subscribePlayerField(player, 'gear'),
			getContent: () => {
				if (!player.armorSpecializationArmorType) {
					return '';
				}

				if (player.hasArmorSpecializationBonus()) {
					return i18n.t('sidebar.warnings.armor_specialization', {
						armorType: armorTypeNames.get(player.armorSpecializationArmorType),
					});
				} else {
					return '';
				}
			},
		},
		{
			updateOn: subscribeAll([subscribePlayerField(player, 'gear'), subscribePlayerField(player, 'talentsString')]),
			getContent: () => {
				if (
					!player.canDualWield2H() &&
					((player.getEquippedItem(ItemSlot.ItemSlotMainHand)?.item.handType == HandType.HandTypeTwoHand &&
						player.getEquippedItem(ItemSlot.ItemSlotOffHand) != null) ||
						player.getEquippedItem(ItemSlot.ItemSlotOffHand)?.item.handType == HandType.HandTypeTwoHand)
				) {
					return i18n.t('sidebar.warnings.dual_wield_2h_without_titans_grip');
				} else {
					return '';
				}
			},
		},
	];
}
