import { Spec } from '@core/proto/common';
import { ElementalShaman_Options_ThunderstormRange } from '@core/proto/shaman';
import { Player } from '@domain/player';
import { EventID } from '@domain/state/batch';
import i18n from '@i18n/config';
import * as InputHelpers from '@ui-kit/input_helpers';
// Configuration for spec-specific UI elements on the settings tab.
// These don't need to be in a separate file but it keeps things cleaner.

export const InThunderstormRange = InputHelpers.makeSpecOptionsBooleanInput<Spec.SpecElementalShaman>({
	fieldName: 'thunderstormRange',
	// id: ActionId.fromSpellId(59159),
	label: i18n.t('rotation_tab.options.shaman.elemental.thunderstorm_in_range.label'),
	labelTooltip: i18n.t('rotation_tab.options.shaman.elemental.thunderstorm_in_range.tooltip'),
	getValue: (player: Player<Spec.SpecElementalShaman>) => player.getSpecOptions().thunderstormRange == ElementalShaman_Options_ThunderstormRange.TSInRange,
	setValue: (eventID: EventID, player: Player<Spec.SpecElementalShaman>, newValue: boolean) => {
		const newOptions = player.getSpecOptions();
		if (newValue) {
			newOptions.thunderstormRange = ElementalShaman_Options_ThunderstormRange.TSInRange;
		} else {
			newOptions.thunderstormRange = ElementalShaman_Options_ThunderstormRange.TSOutofRange;
		}
		player.setSpecOptions(eventID, newOptions);
	},
});
