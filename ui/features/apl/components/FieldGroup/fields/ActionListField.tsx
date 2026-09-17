import { ActionPicker } from '@features/apl/components/ActionPicker';
import { APLAction } from '@generated/proto/apl';
import type { Player } from '@sim/player/player';
import type { InputConfig } from '@ui-kit/input';
import { ListPicker, type ListPickerConfig } from '@ui-kit/ListPicker';

export interface ActionListFieldProps {
	player: Player<any>;
	config: InputConfig<Player<any>, Array<APLAction>> & { id: string };
}

/**
 * The action list of a sequence or strict sequence — the action tree's own recursion edge.
 *
 * Its `itemLabel` is the lowercase literal `'action'`, which is not the priority list's label and
 * is why a sequence's rows never mix with a priority list's: the list only accepts a drag whose
 * label matches.
 */
export const ActionListField = ({ player, config }: ActionListFieldProps) => {
	const listConfig: ListPickerConfig<Player<any>, APLAction> = {
		...config,
		itemLabel: 'action',
		newItem: APLAction.create,
		allowedActions: ['create', 'delete', 'move'],
		actions: { create: { useIcon: true } },
	};

	return (
		<ListPicker<Player<any>, APLAction>
			modObject={player}
			config={listConfig}
			renderItem={(_index, itemConfig) => <ActionPicker player={player} config={itemConfig} />}
		/>
	);
};
