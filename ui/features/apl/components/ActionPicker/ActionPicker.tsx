import { useApl } from '@features/apl/context/AplContext';
import { useAplInput } from '@features/apl/hooks/useAplInput';
import { actionKinds, type APLActionKind } from '@features/apl/model/action_kinds';
import { actionKindOptions } from '@features/apl/model/kind_options';
import { swapActionKind } from '@features/apl/model/kind_swap';
import { APLAction, type APLValue } from '@generated/proto/apl';
import i18n from '@i18n/config';
import type { Player } from '@sim/player/player';
import { DropdownField } from '@ui-kit/DropdownPicker';
import type { InputConfig } from '@ui-kit/input';
import { PickerShell } from '@ui-kit/PickerShell';
import { memo, useId, useMemo } from 'react';

import { FieldGroup } from '../FieldGroup';
import { ValuePicker } from '../ValuePicker';

export interface ActionPickerProps {
	player: Player<any>;
	config: InputConfig<Player<any>, APLAction>;
}

type ValidAPLActionKind = NonNullable<APLActionKind>;

/**
 * One APL action: an optional condition, a kind, and that kind's fields.
 *
 * The condition is a whole `ValuePicker`, and a sequence's field list holds more `ActionPicker`s —
 * so this is the action half of the same cycle `AplField` documents.
 *
 * The kind type is the non-nullable one: the option list is built from the kind table alone, with
 * no empty entry — unlike the value picker's — so "no kind" is not a selection the menu can make.
 *
 * Memoised because a list row hands it a config that lives as long as the row, so a rotation change
 * that leaves the row's content alone stops here instead of re-rendering the row's whole tree.
 */
export const ActionPicker = memo(({ player, config }: ActionPickerProps) => {
	const kindId = useId();
	const { isPrepull, changeSource } = useApl();

	const { value, hidden, disabled, shellConfig } = useAplInput(player, config);
	const kind = value?.action.oneofKind;

	const options = useMemo(() => actionKindOptions(player, isPrepull), [player, isPrepull]);

	const conditionConfig: InputConfig<Player<any>, APLValue | undefined> = {
		label: i18n.t('rotation_tab.apl.priority_list.if_label'),
		extraCssClasses: ['apl-action-condition', 'apl-priority-list-only'],
		getValue: () => config.getValue(player)?.condition,
		setValue: (subject: Player<any>, newValue: APLValue | undefined) => {
			const source = config.getValue(subject);
			if (source) {
				source.condition = newValue;
				subject.touchRotation();
			} else {
				config.setValue(subject, APLAction.create({ condition: newValue }));
			}
		},
	};

	const kindConfig: InputConfig<Player<any>, ValidAPLActionKind> & { id: string } = {
		id: kindId,
		storeSubscribe: changeSource,
		getValue: () => config.getValue(player)?.action.oneofKind as ValidAPLActionKind,
		setValue: (subject: Player<any>, newKind: ValidAPLActionKind) => {
			const source = config.getValue(subject);
			if (source?.action.oneofKind == newKind) return;
			const next = swapActionKind(source, newKind, actionKinds[newKind].newValue);
			if (source) source.action = next.action;
			else config.setValue(subject, next);
			subject.touchRotation();
		},
	};

	const implConfig = (implKind: ValidAPLActionKind): InputConfig<Player<any>, any> => ({
		extraCssClasses: [`apl-action-${implKind}`],
		getValue: () => (config.getValue(player)?.action as any)?.[implKind] || actionKinds[implKind].newValue(),
		setValue: (subject: Player<any>, newValue: any) => {
			const source = config.getValue(subject);
			if (source) (source.action as any)[implKind] = newValue;
			subject.touchRotation();
		},
	});

	return (
		<PickerShell config={shellConfig} className="apl-action-picker-root" hidden={hidden} disabled={disabled}>
			<ValuePicker player={player} config={conditionConfig} />
			<div className="apl-action-picker-action">
				<DropdownField<Player<any>, ValidAPLActionKind>
					modObject={player}
					config={kindConfig}
					options={options}
					defaultLabel={i18n.t('rotation_tab.apl.priority_list.item_label')}
				/>
				{kind && <FieldGroup player={player} config={implConfig(kind)} fields={actionKinds[kind].fields} />}
			</div>
		</PickerShell>
	);
});
