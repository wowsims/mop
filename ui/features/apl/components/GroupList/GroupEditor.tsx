import { AplListItem } from '@features/apl/components/AplListItem';
import { AplNameDialog } from '@features/apl/components/AplNameDialog';
import { ListItemHeader } from '@features/apl/components/ListItemHeader';
import { uuidValidations } from '@features/apl/components/ListItemHeader/utils';
import { NameDisplay } from '@features/apl/components/NameDisplay';
import { useAplInput } from '@features/apl/hooks/useAplInput';
import { useVariableExtraction } from '@features/apl/hooks/useVariableExtraction';
import { rotationSource } from '@features/apl/utils';
import { APLGroup, APLListItem } from '@generated/proto/apl';
import i18n from '@i18n/config';
import type { Player } from '@sim/player/player';
import { renameAPLReference } from '@sim/proto/apl_utils';
import type { InputConfig } from '@ui-kit/input';
import { ListPicker, type ListPickerConfig } from '@ui-kit/ListPicker';
import { PickerShell } from '@ui-kit/PickerShell';
import { useState } from 'react';

export interface GroupEditorProps {
	player: Player<any>;
	config: InputConfig<Player<any>, APLGroup>;
	/** Position in the rotation's group list, which is how the sim reports this group's validations. */
	groupIndex: number;
}

/** One action group: its name, and the priority list it holds. */
export const GroupEditor = ({ player, config, groupIndex }: GroupEditorProps) => {
	const { value: group, hidden, disabled, shellConfig } = useAplInput(player, config);
	const [renaming, setRenaming] = useState(false);

	const actions = () => config.getValue(player)?.actions || [];
	const extraction = useVariableExtraction(
		player,
		index => actions()[index]?.action?.condition,
		(index, reference) => {
			actions()[index].action!.condition = reference;
		},
	);

	const actionsConfig: ListPickerConfig<Player<any>, APLListItem> = {
		extraCssClasses: ['apl-list-item-picker'],
		title: i18n.t('rotation_tab.apl.actionGroups.attributes.actions'),
		titleTooltip: i18n.t('rotation_tab.apl.actionGroups.tooltips.actions'),
		itemLabel: i18n.t('rotation_tab.apl.priorityList.name'),
		actions: { create: { useIcon: true } },
		storeSubscribe: rotationSource,
		getValue: () => config.getValue(player)?.actions || [],
		setValue: (subject: Player<any>, next: Array<APLListItem>) => {
			const current = config.getValue(subject);
			if (!current) return;
			current.actions = next;
			subject.touchRotation();
		},
		newItem: () => APLListItem.create({ action: {} }),
		copyItem: (oldItem: APLListItem) => APLListItem.clone(oldItem),
		inlineMenuBar: true,
		allowedActions: ['create', 'copy', 'delete', 'move'],
		dragGroup: 'action-group-actions',
		sameGroupOnly: true,
		extraActions: [extraction.extraAction],
	};

	return (
		<PickerShell
			config={{ ...shellConfig, extraCssClasses: [...(config.extraCssClasses || []), 'apl-list-item-picker-root'] }}
			className="apl-group-editor-root"
			hidden={hidden}
			disabled={disabled}>
			<div className="apl-action-picker-root">
				<NameDisplay name={group?.name || ''} onRename={() => setRenaming(true)} />
				<div className="apl-group-actions-container">
					<ListPicker<Player<any>, APLListItem>
						modObject={player}
						config={actionsConfig}
						renderItem={(_index, itemConfig) => <AplListItem player={player} config={itemConfig} />}
						renderItemHeader={index => (
							<ListItemHeader
								player={player}
								getItem={() => actions()[index]}
								getValidations={subject => [
									...(subject.getCurrentStats().rotationStats?.groups?.[groupIndex]?.actions?.[index]?.validations || []),
									...uuidValidations(subject, actions()[index]?.action?.condition?.uuid?.value),
								]}
							/>
						)}
					/>
				</div>
			</div>
			<AplNameDialog
				open={renaming}
				title={i18n.t('rotation_tab.apl.nameModal.rename', { itemName: i18n.t('rotation_tab.apl.actionGroups.name') })}
				inputLabel={i18n.t('rotation_tab.apl.actionGroups.attributes.name')}
				confirmLabel={i18n.t('rotation_tab.apl.nameModal.renameConfirm')}
				defaultValue={group?.name}
				existingNames={(player.aplRotation.groups || []).filter(other => other !== group).map(other => other.name)}
				onSubmit={name =>
					player.modifyAplRotation(rotation => {
						if (!group) return;
						renameAPLReference(rotation, { type: 'group', oldName: group.name, newName: name });
						group.name = name;
					})
				}
				onClose={() => setRenaming(false)}
			/>
			<AplNameDialog {...extraction.dialog} />
		</PickerShell>
	);
};
