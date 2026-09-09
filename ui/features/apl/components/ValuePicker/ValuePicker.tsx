import { useApl } from '@features/apl/context/AplContext';
import { useAplInput } from '@features/apl/hooks/useAplInput';
import { valueKindOptions } from '@features/apl/model/kind_options';
import { swapValueKind } from '@features/apl/model/kind_swap';
import { type APLValueKind, type ValidAPLValueKind, valueKinds } from '@features/apl/model/value_kinds';
import { rotationSource } from '@features/apl/utils';
import type { APLValue } from '@generated/proto/apl';
import { UUID } from '@generated/proto/common';
import i18n from '@i18n/config';
import type { Player } from '@sim/player/player';
import { randomUUID } from '@sim/utils/misc';
import { DropdownField, type DropdownOption } from '@ui-kit/DropdownPicker';
import type { InputConfig } from '@ui-kit/input';
import { PickerShell } from '@ui-kit/PickerShell';
import { useEffect, useId, useMemo } from 'react';

import { FieldGroup } from '../FieldGroup';

export interface ValuePickerProps {
	player: Player<any>;
	config: InputConfig<Player<any>, APLValue | undefined>;
}

/**
 * One APL value: a kind, and the fields that kind has.
 *
 * The recursion lives in those fields — a comparison holds two values, an `and` holds a list of
 * them — so this component reaches itself through `FieldGroup` and `AplField`. See `AplField` for
 * why that cycle is safe and what would break it.
 *
 * Nothing here holds a copy of the value: each picker writes its own property of the live message,
 * and the rotation notification is what re-renders.
 */
export const ValuePicker = ({ player, config }: ValuePickerProps) => {
	const kindId = useId();
	const { isPrepull, isGroup } = useApl();

	const { value, hidden, disabled, shellConfig } = useAplInput(player, config);
	const kind = value?.value.oneofKind;

	// A value loaded from a preset or an import may carry no uuid, and the sim keys its per-value
	// validations on one. Minting it is a silent write, deliberately without a notification — it
	// changes nothing the user can see.
	useEffect(() => {
		if (value && !value.uuid?.value) value.uuid = UUID.create({ value: randomUUID() });
	}, [value]);

	const options = useMemo<Array<DropdownOption<APLValueKind>>>(
		() => [{ value: undefined, label: i18n.t('rotation_tab.apl.values.none') }, ...valueKindOptions(player, isPrepull, isGroup)],
		[player, isPrepull, isGroup],
	);

	const kindConfig: InputConfig<Player<any>, APLValueKind> & { id: string } = {
		id: kindId,
		storeSubscribe: rotationSource,
		getValue: () => config.getValue(player)?.value.oneofKind,
		setValue: (subject: Player<any>, newKind: APLValueKind) => {
			const source = config.getValue(subject);
			if (source?.value.oneofKind == newKind) return;
			if (newKind) {
				const next = swapValueKind(source, newKind, valueKinds[newKind].newValue);
				if (source) source.value = next.value;
				else config.setValue(subject, next);
			} else {
				config.setValue(subject, undefined);
			}
			subject.touchRotation();
		},
	};

	const implConfig = (implKind: ValidAPLValueKind): InputConfig<Player<any>, any> => ({
		getValue: () => {
			const source = config.getValue(player);
			return (source && (source.value as any)[implKind]) || valueKinds[implKind].newValue();
		},
		setValue: (subject: Player<any>, newValue: any) => {
			const source = config.getValue(subject);
			if (source) (source.value as any)[implKind] = newValue;
			subject.touchRotation();
		},
	});

	return (
		<PickerShell config={shellConfig} className="apl-value-picker-root" hidden={hidden} disabled={disabled}>
			<DropdownField<Player<any>, APLValueKind>
				modObject={player}
				config={kindConfig}
				options={options}
				defaultLabel={i18n.t('rotation_tab.apl.values.no_condition')}
			/>
			{kind && <FieldGroup player={player} config={implConfig(kind)} fields={valueKinds[kind].fields} />}
		</PickerShell>
	);
};
