import { OtherAction } from '@core/proto/common';
import { UnitMetadata } from '@domain/player';
import { ActionId } from '@domain/proto_utils/action_id';
import { bucket } from '@domain/utils';
import i18n from '@i18n/config';
import type { DropdownValueConfig } from '@ui-kit/pickers/dropdown_picker';

export type ACTION_ID_SET =
	| 'auras'
	| 'stackable_auras'
	| 'icd_auras'
	| 'exclusive_effect_auras'
	| 'spells'
	| 'castable_spells'
	| 'channel_spells'
	| 'dot_spells'
	| 'castable_dot_spells'
	| 'shield_spells'
	| 'non_instant_spells'
	| 'friendly_spells'
	| 'expected_dot_spells'
	| 'spells_with_travelTime';

export const actionIdSets: Record<
	ACTION_ID_SET,
	{
		defaultLabel: string;
		getActionIDs: (metadata: UnitMetadata) => Promise<Array<DropdownValueConfig<ActionId>>>;
	}
> = {
	auras: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.auras'),
		getActionIDs: async metadata => {
			return metadata.getAuras().map(actionId => {
				return {
					value: actionId.id,
				};
			});
		},
	},
	stackable_auras: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.stackable_auras'),
		getActionIDs: async metadata => {
			return metadata
				.getAuras()
				.filter(aura => aura.data.maxStacks > 0)
				.map(actionId => {
					return {
						value: actionId.id,
					};
				});
		},
	},
	icd_auras: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.icd_auras'),
		getActionIDs: async metadata => {
			return metadata
				.getAuras()
				.filter(aura => aura.data.hasIcd)
				.map(actionId => {
					return {
						value: actionId.id,
					};
				});
		},
	},
	exclusive_effect_auras: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.exclusive_effect_auras'),
		getActionIDs: async metadata => {
			return metadata
				.getAuras()
				.filter(aura => aura.data.hasExclusiveEffect)
				.map(actionId => {
					return {
						value: actionId.id,
					};
				});
		},
	},
	// Used for non categorized lists
	spells: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.spells'),
		getActionIDs: async metadata => {
			return metadata
				.getSpells()
				.filter(spell => spell.data.isCastable)
				.map(actionId => {
					return {
						value: actionId.id,
					};
				});
		},
	},
	castable_spells: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.castable_spells'),
		getActionIDs: async metadata => {
			const castableSpells = metadata.getSpells().filter(spell => spell.data.isCastable);

			// Split up non-cooldowns and cooldowns into separate sections for easier browsing.
			const { spells, cooldowns, nonCombatPotion } = bucket(castableSpells, spell =>
				spell.data.isNonCombatPotion ? 'nonCombatPotion' : spell.data.isMajorCooldown ? 'cooldowns' : 'spells',
			);

			const placeholders: Array<ActionId> = [ActionId.fromOtherId(OtherAction.OtherActionPotion)];

			return [
				[
					{
						value: ActionId.fromEmpty(),
						headerText: i18n.t('rotation_tab.apl.submenus.spell'),
						submenu: ['spell'],
					},
				],
				(spells || []).map(actionId => {
					return {
						value: actionId.id,
						submenu: ['spell'],
						extraCssClasses: actionId.data.prepullOnly
							? ['apl-prepull-actions-only']
							: actionId.data.encounterOnly
								? ['apl-priority-list-only']
								: [],
					};
				}),
				[
					{
						value: ActionId.fromEmpty(),
						headerText: i18n.t('rotation_tab.apl.submenus.cooldowns'),
						submenu: ['cooldowns'],
					},
				],
				(cooldowns || []).map(actionId => {
					return {
						value: actionId.id,
						submenu: ['cooldowns'],
						extraCssClasses: actionId.data.prepullOnly
							? ['apl-prepull-actions-only']
							: actionId.data.encounterOnly
								? ['apl-priority-list-only']
								: [],
					};
				}),
				[
					{
						value: ActionId.fromEmpty(),
						headerText: i18n.t('rotation_tab.apl.submenus.non_combat_potions'),
						submenu: ['non_combat_potions'],
					},
				],
				(nonCombatPotion || []).map(actionId => {
					return {
						value: actionId.id,
						submenu: ['non_combat_potions'],
						extraCssClasses: actionId.data.prepullOnly
							? ['apl-prepull-actions-only']
							: actionId.data.encounterOnly
								? ['apl-priority-list-only']
								: [],
					};
				}),
				[
					{
						value: ActionId.fromEmpty(),
						headerText: i18n.t('rotation_tab.apl.submenus.placeholders'),
						submenu: ['placeholders'],
					},
				],
				placeholders.map(actionId => {
					return {
						value: actionId,
						submenu: ['placeholders'],
						tooltip: i18n.t('rotation_tab.apl.helpers.placeholder_tooltip'),
					};
				}),
			].flat();
		},
	},
	non_instant_spells: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.non_instant_spells'),
		getActionIDs: async metadata => {
			return metadata
				.getSpells()
				.filter(spell => spell.data.isCastable && spell.data.hasCastTime)
				.map(actionId => {
					return {
						value: actionId.id,
					};
				});
		},
	},
	friendly_spells: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.friendly_spells'),
		getActionIDs: async metadata => {
			return metadata
				.getSpells()
				.filter(spell => spell.data.isCastable && spell.data.isFriendly)
				.map(actionId => {
					return {
						value: actionId.id,
					};
				});
		},
	},
	channel_spells: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.channel_spells'),
		getActionIDs: async metadata => {
			return metadata
				.getSpells()
				.filter(spell => spell.data.isCastable && spell.data.isChanneled)
				.map(actionId => {
					return {
						value: actionId.id,
					};
				});
		},
	},
	dot_spells: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.dot_spells'),
		getActionIDs: async metadata => {
			return (
				metadata
					.getSpells()
					.filter(spell => spell.data.hasDot)
					// filter duplicate dot entries from RelatedDotSpell
					.filter((value, index, self) => self.findIndex(v => v.id.anyId() === value.id.anyId()) === index)
					.map(actionId => {
						return {
							value: actionId.id,
						};
					})
			);
		},
	},
	castable_dot_spells: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.castable_dot_spells'),
		getActionIDs: async metadata => {
			return metadata
				.getSpells()
				.filter(spell => spell.data.isCastable && spell.data.hasDot)
				.map(actionId => {
					return {
						value: actionId.id,
					};
				});
		},
	},
	expected_dot_spells: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.expected_dot_spells'),
		getActionIDs: async metadata => {
			return (
				metadata
					.getSpells()
					.filter(spell => spell.data.hasExpectedTick)
					// filter duplicate dot entries from RelatedDotSpell
					.filter((value, index, self) => self.findIndex(v => v.id.anyId() === value.id.anyId()) === index)
					.map(actionId => {
						return {
							value: actionId.id,
						};
					})
			);
		},
	},
	shield_spells: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.shield_spells'),
		getActionIDs: async metadata => {
			return metadata
				.getSpells()
				.filter(spell => spell.data.hasShield)
				.map(actionId => {
					return {
						value: actionId.id,
					};
				});
		},
	},
	spells_with_travelTime: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.spells_with_travelTime'),
		getActionIDs: async metadata => {
			return metadata
				.getSpells()
				.filter(spell => spell.data.hasMissileSpeed)
				.map(actionId => {
					return {
						value: actionId.id,
					};
				});
		},
	},
};
