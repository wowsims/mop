import * as InputHelpers from '../core/components/input_helpers';
import { HunterSpecs } from '../core/proto_utils/utils';
import { makePetTypeInputConfig } from '../core/talents/hunter_pet';
import i18n from '../i18n/config.js';

// // Configuration for class-specific UI elements on the settings tab.
// // These don't need to be in a separate file but it keeps things cleaner.

export const PetTypeInput = <SpecType extends HunterSpecs>() => makePetTypeInputConfig<SpecType>();

export const PetUptime = <SpecType extends HunterSpecs>() =>
	InputHelpers.makeClassOptionsNumberInput<SpecType>({
		fieldName: 'petUptime',
		label: i18n.t('settings_tab.other.pet_uptime.label'),
		labelTooltip: i18n.t('settings_tab.other.pet_uptime.tooltip'),
		percent: true,
	});

export const GlaiveTossChance = <SpecType extends HunterSpecs>() =>
	InputHelpers.makeClassOptionsNumberInput<SpecType>({
		fieldName: 'glaiveTossSuccess',
		label: i18n.t('settings_tab.other.glaive_toss_chance.label'),
		labelTooltip: i18n.t('settings_tab.other.glaive_toss_chance.tooltip'),
		percent: true,
	});
