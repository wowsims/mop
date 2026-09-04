import { Player } from '@domain/player';
import { Spec } from '@generated/proto/common';
import i18n from '@i18n/config';
import * as InputHelpers from '@ui-kit/input_helpers';

// Configuration for spec-specific UI elements on the settings tab.
// These don't need to be in a separate file but it keeps things cleaner.

export const HonorAmongThievesCritRate = InputHelpers.makeSpecOptionsNumberInput<Spec.SpecSubtletyRogue>({
	fieldName: 'honorAmongThievesCritRate',
	label: i18n.t('rotation_tab.options.rogue.subtlety.honor_of_thieves_crit_rate.label'),
	labelTooltip: i18n.t('rotation_tab.options.rogue.subtlety.honor_of_thieves_crit_rate.tooltip'),
	showWhen: (_player: Player<Spec.SpecSubtletyRogue>) => false,
});
