import { APLValue, APLValueVariable } from '@generated/proto/apl';
import i18n from '@i18n/config';
import type { Player } from '@sim/player/player';
import { randomUUID } from '@sim/utils/misc';
import type { ListPickerExtraAction } from '@ui-kit/ListPicker';
import { useRef, useState } from 'react';

export interface VariableExtraction {
	/** The list's per-item menu entry, hidden for an item there is nothing to extract from. */
	extraAction: ListPickerExtraAction;
	dialog: {
		open: boolean;
		title: string;
		inputLabel: string;
		confirmLabel: string;
		existingNames: Array<string>;
		onSubmit: (name: string) => void;
		onClose: () => void;
	};
}

/**
 * "Extract to variable": names the value at one index, moves it into the rotation's variable list
 * and leaves a reference behind.
 *
 * Three lists offer it — the priority list, a group's actions and any nested value list — and each
 * reaches its value differently, so the two accessors are the parameter. A value that is already a
 * variable reference, or has no kind at all, has nothing to extract and the entry stays hidden.
 */
export const useVariableExtraction = (
	player: Player<any>,
	getValue: (index: number) => APLValue | undefined,
	setValue: (index: number, reference: APLValue) => void,
): VariableExtraction => {
	const accessors = useRef({ getValue, setValue });
	accessors.current = { getValue, setValue };

	const [index, setIndex] = useState<number | null>(null);

	const isExtractable = (at: number): boolean => {
		const value = accessors.current.getValue(at);
		return !!value && !!value.value.oneofKind && value.value.oneofKind !== 'variableRef';
	};

	return {
		extraAction: {
			cssClass: 'list-picker-item-extract-variable',
			icon: 'fa-arrow-right-from-bracket',
			tooltip: i18n.t('rotation_tab.apl.variables.extractToVariable'),
			shouldShow: isExtractable,
			onClick: (at: number) => {
				if (isExtractable(at)) setIndex(at);
			},
		},
		dialog: {
			open: index !== null,
			title: i18n.t('rotation_tab.apl.variables.extractToVariable'),
			inputLabel: i18n.t('rotation_tab.apl.variables.attributes.name'),
			confirmLabel: i18n.t('rotation_tab.apl.nameModal.extract'),
			existingNames: (player.aplRotation.valueVariables || []).map(variable => variable.name),
			onSubmit: (name: string) => {
				if (index === null) return;
				const value = accessors.current.getValue(index);
				if (!value) return;
				if (!player.aplRotation.valueVariables) player.aplRotation.valueVariables = [];
				player.aplRotation.valueVariables.push(APLValueVariable.create({ name, value: APLValue.clone(value) }));
				accessors.current.setValue(
					index,
					APLValue.create({ value: { oneofKind: 'variableRef', variableRef: { name } }, uuid: { value: randomUUID() } }),
				);
				player.touchRotation();
			},
			onClose: () => setIndex(null),
		},
	};
};
