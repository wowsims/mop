import { Player } from '@domain/player';
import { ActionId } from '@domain/proto_utils/action_id';
import type { PaladinSpecs } from '@domain/proto_utils/spec_types';
import { subscribePlayerChange } from '@domain/state/subscriptions';
import { Spec } from '@generated/proto/common';
import { PaladinSeal } from '@generated/proto/paladin';
import * as InputHelpers from '@ui-kit/input_helpers';

// Configuration for spec-specific UI elements on the settings tab.
// These don't need to be in a separate file but it keeps things cleaner.

export const StartingSealSelection = <SpecType extends PaladinSpecs>() =>
	InputHelpers.makeClassOptionsEnumIconInput<SpecType, PaladinSeal>({
		fieldName: 'seal',
		values: [
			{ actionId: ActionId.fromSpellId(31801), value: PaladinSeal.Truth },
			{ actionId: ActionId.fromSpellId(20154), value: PaladinSeal.Righteousness },
			{ actionId: ActionId.fromSpellId(20165), value: PaladinSeal.Insight },
			{
				actionId: ActionId.fromSpellId(20164),
				value: PaladinSeal.Justice,
				showWhen: player => player.isSpec(Spec.SpecRetributionPaladin),
			},
		],
		storeSubscribe: (player: Player<SpecType>) => subscribePlayerChange(player),
	});
