import { Player } from '@domain/player';
import { ActionId } from '@domain/proto_utils/action_id';
import { WarlockSpecs } from '@domain/proto_utils/utils';
import { subscribePlayerChange } from '@domain/state/subscriptions';
import { Spec } from '@generated/proto/common';
import { WarlockOptions_Summon as Summon } from '@generated/proto/warlock';
import * as InputHelpers from '@ui-kit/input_helpers';

// Configuration for spec-specific UI elements on the settings tab.
// These don't need to be in a separate file but it keeps things cleaner.

export const PetInput = <SpecType extends WarlockSpecs>() =>
	InputHelpers.makeClassOptionsEnumIconInput<SpecType, Summon>({
		fieldName: 'summon',
		values: [
			{ value: Summon.NoSummon, tooltip: 'No Pet' },
			{ actionId: ActionId.fromSpellId(691), value: Summon.Felhunter },
			{
				actionId: ActionId.fromSpellId(30146),
				value: Summon.Felguard,
				showWhen: (player: Player<SpecType>) => player.getSpec() == Spec.SpecDemonologyWarlock,
			},
			{ actionId: ActionId.fromSpellId(688), value: Summon.Imp },
			{ actionId: ActionId.fromSpellId(712), value: Summon.Succubus },
			{ actionId: ActionId.fromSpellId(697), value: Summon.Voidwalker },
		],
		storeSubscribe: (player: Player<SpecType>) => subscribePlayerChange(player),
	});
