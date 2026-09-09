import { AplNameDialog } from '@features/apl/components/AplNameDialog';
import { FloatingActionBar } from '@features/apl/components/FloatingActionBar';
import { AplProvider } from '@features/apl/context/AplContext';
import { useRenamedCopy } from '@features/apl/hooks/useRenamedCopy';
import { rotationSource } from '@features/apl/utils';
import { APLGroup } from '@generated/proto/apl';
import i18n from '@i18n/config';
import { usePlayer } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import { ListPicker, type ListPickerConfig } from '@ui-kit/ListPicker';

import { GroupEditor } from './GroupEditor';

const groupName = () => i18n.t('rotation_tab.apl.actionGroups.name');
const newGroup = (name: string) => APLGroup.create({ name, actions: [], variables: [] });

/**
 * The rotation's action groups.
 *
 * Both creating and copying a group ask for a name first, because a group is referenced by name —
 * so unlike every other list here, neither action can just append a clone.
 */
export const GroupList = () => {
	const player = usePlayer();
	const groups = () => player.aplRotation.groups || [];
	const copying = useRenamedCopy(player, {
		itemName: groupName(),
		inputLabel: i18n.t('rotation_tab.apl.actionGroups.attributes.name'),
		read: rotation => rotation.groups || [],
		write: (rotation, next) => {
			rotation.groups = next;
		},
		nameOf: group => group.name,
		copy: (group, name) => {
			const clone = APLGroup.clone(group);
			clone.name = name;
			return clone;
		},
	});

	const config: ListPickerConfig<Player<any>, APLGroup> = {
		title: i18n.t('rotation_tab.apl.actionGroups.header'),
		titleTooltip: i18n.t('rotation_tab.apl.actionGroups.tooltips.overview'),
		extraCssClasses: ['apl-list-item-picker', 'apl-groups-picker'],
		itemLabel: groupName(),
		storeSubscribe: rotationSource,
		getValue: (subject: Player<any>) => subject.aplRotation.groups || [],
		setValue: (subject: Player<any>, next: Array<APLGroup>) =>
			subject.modifyAplRotation(rotation => {
				rotation.groups = next;
			}),
		newItem: () => newGroup(i18n.t('rotation_tab.apl.actionGroups.newGroupName')),
		onCopyItem: copying.onCopyItem,
		allowedActions: ['copy', 'delete', 'move'],
		inlineMenuBar: true,
	};

	const appendGroup = (name?: string) =>
		player.modifyAplRotation(rotation => {
			rotation.groups = [...(rotation.groups || []), newGroup(name!)];
		});

	return (
		<AplProvider isGroup>
			<div className="apl-group-list-picker-root">
				<ListPicker<Player<any>, APLGroup>
					modObject={player}
					config={config}
					renderItem={(index, itemConfig) => <GroupEditor player={player} config={itemConfig} groupIndex={index} />}
				/>
				<FloatingActionBar
					itemName={groupName()}
					nameDialog={{
						inputLabel: i18n.t('rotation_tab.apl.actionGroups.attributes.name'),
						existingNames: () => groups().map(group => group.name),
					}}
					onCreate={appendGroup}
				/>
				<AplNameDialog {...copying.dialog} />
			</div>
		</AplProvider>
	);
};
