// Configuration for spec-specific UI elements on the settings tab.
// These don't need to be in a separate file but it keeps things cleaner.

import { Spec } from '@generated/proto/common';
import { WarriorSyncType } from '@generated/proto/warrior';
import i18n from '@i18n/config';
import * as InputHelpers from '@ui-kit/input_helpers';

export const SyncTypeInput = InputHelpers.makeSpecOptionsEnumInput<Spec.SpecFuryWarrior, WarriorSyncType>({
	fieldName: 'syncType',
	label: i18n.t('settings_tab.other.sync_type.label'),
	labelTooltip: i18n.t('settings_tab.other.sync_type.tooltip'),
	values: [
		{ name: i18n.t('settings_tab.other.sync_type.values.none'), value: WarriorSyncType.WarriorNoSync },
		{ name: i18n.t('settings_tab.other.sync_type.values.perfect_sync'), value: WarriorSyncType.WarriorSyncMainhandOffhandSwings },
	],
});
