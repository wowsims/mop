import { AplNameDialog } from '@features/apl/components/AplNameDialog';
import { FloatingActionBar } from '@features/apl/components/FloatingActionBar';
import { AplValidations } from '@features/apl/components/ListItemHeader';
import { uuidValidations } from '@features/apl/components/ListItemHeader/utils';
import { useRenamedCopy } from '@features/apl/hooks/useRenamedCopy';
import { rotationSource } from '@features/apl/utils';
import { APLValueVariable } from '@generated/proto/apl';
import i18n from '@i18n/config';
import { usePlayer } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import { ListPicker, type ListPickerConfig } from '@ui-kit/ListPicker';

import { VariableItem } from './VariableItem';

const variableName = () => i18n.t('rotation_tab.apl.variables.name');

/** The rotation's named values, which any condition can reference. */
export const VariablesList = () => {
	const player = usePlayer();
	const variables = () => player.aplRotation.valueVariables || [];
	const copying = useRenamedCopy(player, {
		itemName: variableName(),
		inputLabel: i18n.t('rotation_tab.apl.variables.attributes.name'),
		read: rotation => rotation.valueVariables || [],
		write: (rotation, next) => {
			rotation.valueVariables = next;
		},
		nameOf: variable => variable.name,
		// `create` re-creates nested messages recursively, so the copy's value shares nothing with the original's.
		copy: (variable, name) => APLValueVariable.create({ name, value: variable.value }),
	});

	const config: ListPickerConfig<Player<any>, APLValueVariable> = {
		title: i18n.t('rotation_tab.apl.variables.header'),
		titleTooltip: i18n.t('rotation_tab.apl.variables.tooltips.overview'),
		extraClassNames: ['apl-list-item-picker', 'apl-value-variables-picker'],
		itemLabel: variableName(),
		storeSubscribe: rotationSource,
		getValue: (subject: Player<any>) => subject.aplRotation.valueVariables || [],
		setValue: (subject: Player<any>, next: Array<APLValueVariable>) =>
			subject.modifyAplRotation(rotation => {
				rotation.valueVariables = next;
			}),
		newItem: () => APLValueVariable.create({ name: i18n.t('rotation_tab.apl.variables.newVariableName'), value: undefined }),
		onCopyItem: copying.onCopyItem,
		allowedActions: ['copy', 'delete', 'move'],
		inlineMenuBar: true,
	};

	return (
		<div className="apl-variables-list-picker-root">
			<ListPicker<Player<any>, APLValueVariable>
				modObject={player}
				config={config}
				renderItem={(_index, itemConfig) => <VariableItem player={player} config={itemConfig} />}
				renderItemHeader={index => <AplValidations getValidations={subject => uuidValidations(subject, variables()[index]?.value?.uuid?.value)} />}
			/>
			<FloatingActionBar
				itemName={variableName()}
				nameDialog={{
					inputLabel: i18n.t('rotation_tab.apl.variables.attributes.name'),
					existingNames: () => variables().map(variable => variable.name),
				}}
				onCreate={name =>
					player.modifyAplRotation(rotation => {
						rotation.valueVariables = [...(rotation.valueVariables || []), APLValueVariable.create({ name: name!, value: undefined })];
					})
				}
			/>
			<AplNameDialog {...copying.dialog} />
		</div>
	);
};
