import { AplNameDialog } from '@features/apl/components/AplNameDialog';
import { NameDisplay } from '@features/apl/components/NameDisplay';
import { ValuePicker } from '@features/apl/components/ValuePicker';
import { useAplInput } from '@features/apl/hooks/useAplInput';
import type { APLValue, APLValueVariable } from '@generated/proto/apl';
import i18n from '@i18n/config';
import type { Player } from '@sim/player/player';
import { renameAPLReference } from '@sim/proto/apl_utils';
import type { InputConfig } from '@ui-kit/input';
import { PickerShell } from '@ui-kit/PickerShell';
import { useState } from 'react';

export interface VariableItemProps {
	player: Player<any>;
	config: InputConfig<Player<any>, APLValueVariable>;
}

/** One named value variable: its name, and the value it stands for. */
export const VariableItem = ({ player, config }: VariableItemProps) => {
	const { value: variable, hidden, disabled, shellConfig } = useAplInput(player, config);
	const [renaming, setRenaming] = useState(false);

	return (
		<PickerShell
			config={{ ...shellConfig, extraCssClasses: [...(config.extraCssClasses || []), 'apl-list-item-picker-root'] }}
			className="apl-value-variable-picker-root"
			hidden={hidden}
			disabled={disabled}>
			<div className="apl-action-picker-root">
				<NameDisplay name={variable?.name || ''} onRename={() => setRenaming(true)} />
				<ValuePicker
					player={player}
					config={{
						label: i18n.t('rotation_tab.apl.variables.attributes.value'),
						labelTooltip: i18n.t('rotation_tab.apl.variables.attributes.valueTooltip'),
						getValue: () => config.getValue(player)?.value,
						setValue: (subject: Player<any>, newValue: APLValue | undefined) => {
							const current = config.getValue(subject);
							if (!current) return;
							current.value = newValue;
							// The variable list owns the array; writing through it is what notifies.
							config.setValue(subject, current);
						},
					}}
				/>
			</div>
			<AplNameDialog
				open={renaming}
				title={i18n.t('rotation_tab.apl.nameModal.rename', { itemName: i18n.t('rotation_tab.apl.variables.name') })}
				inputLabel={i18n.t('rotation_tab.apl.variables.attributes.name')}
				confirmLabel={i18n.t('rotation_tab.apl.nameModal.renameConfirm')}
				defaultValue={variable?.name}
				existingNames={(player.aplRotation.valueVariables || []).filter(other => other !== variable).map(other => other.name)}
				onSubmit={name =>
					player.modifyAplRotation(rotation => {
						if (!variable) return;
						renameAPLReference(rotation, { type: 'variable', oldName: variable.name, newName: name });
						variable.name = name;
					})
				}
				onClose={() => setRenaming(false)}
			/>
		</PickerShell>
	);
};
