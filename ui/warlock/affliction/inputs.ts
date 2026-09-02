import { Player } from '@domain/player';
import i18n from '@i18n/config';
import * as InputHelpers from '@ui-kit/input_helpers';

import { Spec } from '../../core/proto/common';


export const ExhaleWindow = InputHelpers.makeSpecOptionsNumberInput<Spec.SpecAfflictionWarlock>({
	fieldName: 'exhaleWindow',
	label: i18n.t('rotation_tab.options.warlock.affliction.exhale_window.label'),
	labelTooltip: i18n.t('rotation_tab.options.warlock.affliction.exhale_window.tooltip'),
	showWhen: (player: Player<Spec.SpecAfflictionWarlock>) => true,
});
