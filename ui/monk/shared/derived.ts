import { subscribePlayerField } from '@domain/state/subscriptions';
import type { DerivedSetting } from '@features/spec_config';

import * as MonkUtils from '../utils';

// Zen Sphere / Chi Wave decide how many target dummies the raid needs, so the
// setting is derived from the talent string. Both monk spec constructors applied
// it once and re-applied it on every talent change.
//
// Declared as `DerivedSetting<any>` because `Player<S>` is invariant in `S`, so a
// rule typed against the monk spec union would not be assignable into any one
// spec's `derivedSettings`.
export const talentBasedSettingsRule: DerivedSetting<any> = {
	subscribe: player => subscribePlayerField(player, 'talentsString'),
	apply: (_eventID, player) => MonkUtils.setTalentBasedSettings(player),
};
