import { Player } from '@domain/player';
import * as InputHelpers from '@ui-kit/input_helpers';

import { Spec } from '../../core/proto/common';
import i18n from '../../i18n/config';

// Configuration for spec-specific UI elements on the settings tab.
// These don't need to be in a separate file but it keeps things cleaner.

export const HonorAmongThievesCritRate = InputHelpers.makeSpecOptionsNumberInput<Spec.SpecSubtletyRogue>({
	fieldName: 'honorAmongThievesCritRate',
	label: i18n.t('rotation_tab.options.rogue.subtlety.honor_of_thieves_crit_rate.label'),
	labelTooltip: i18n.t('rotation_tab.options.rogue.subtlety.honor_of_thieves_crit_rate.tooltip'),
	showWhen: (player: Player<Spec.SpecSubtletyRogue>) => false,
});
