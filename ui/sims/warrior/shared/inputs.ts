import { Spec } from '@generated/proto/common';
import i18n from '@i18n/config';
import * as InputHelpers from '@ui-kit/input_helpers';

// Configuration for class-specific UI elements on the settings tab.
// These don't need to be in a separate file but it keeps things cleaner.

// Arms/Fury only

export const StanceSnapshot = <SpecType extends Spec.SpecArmsWarrior | Spec.SpecFuryWarrior>() =>
	InputHelpers.makeSpecOptionsBooleanInput<SpecType>({
		fieldName: 'stanceSnapshot',
		label: i18n.t('settings_tab.other.stance_snapshot.label'),
		labelTooltip: i18n.t('settings_tab.other.stance_snapshot.tooltip'),
	});

