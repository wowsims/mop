import { AplNameDialog } from '@features/apl/components/AplNameDialog';
import { AplValidations } from '@features/apl/components/ListItemHeader';
import { uuidValidations } from '@features/apl/components/ListItemHeader/utils';
import { ValuePicker } from '@features/apl/components/ValuePicker';
import { useVariableExtraction } from '@features/apl/hooks/useVariableExtraction';
import { APLValue } from '@generated/proto/apl';
import type { Player } from '@sim/player/player';
import { randomUUID } from '@sim/utils/misc';
import type { InputConfig } from '@ui-kit/input';
import { ListPicker, type ListPickerConfig } from '@ui-kit/ListPicker';

export interface ValueListFieldProps {
	player: Player<any>;
	config: InputConfig<Player<any>, Array<APLValue | undefined>> & { id: string };
}

const newValue = () => APLValue.create({ uuid: { value: randomUUID() } });

/**
 * The operand list of `and`, `or`, `min` and `max`.
 *
 * Each row is a whole `ValuePicker`, so this is one of the two edges the value tree recurses
 * across. The row's own validations ride in the item header.
 */
export const ValueListField = ({ player, config }: ValueListFieldProps) => {
	const values = () => config.getValue(player) || [];
	const extraction = useVariableExtraction(
		player,
		index => values()[index],
		(index, reference) => {
			const list = values();
			list[index] = reference;
			config.setValue(player, list);
		},
	);

	const listConfig: ListPickerConfig<Player<any>, APLValue | undefined> = {
		...config,
		// An empty row is stored as a value with a uuid, never as a hole.
		setValue: (subject: Player<any>, next: Array<APLValue | undefined>) =>
			config.setValue(
				subject,
				next.map(value => value || newValue()),
			),
		itemLabel: 'Value',
		newItem: newValue,
		copyItem: (oldValue: APLValue | undefined) => (oldValue ? APLValue.clone(oldValue) : oldValue),
		allowedActions: ['copy', 'create', 'delete', 'move'],
		actions: { create: { useIcon: true } },
		extraActions: [extraction.extraAction],
	};

	return (
		<>
			<ListPicker<Player<any>, APLValue | undefined>
				modObject={player}
				config={listConfig}
				renderItem={(_index, itemConfig) => <ValuePicker player={player} config={itemConfig} />}
				renderItemHeader={index => <AplValidations getValidations={subject => uuidValidations(subject, values()[index]?.uuid?.value)} />}
			/>
			<AplNameDialog {...extraction.dialog} />
		</>
	);
};
