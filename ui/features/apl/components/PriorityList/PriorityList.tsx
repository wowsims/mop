import { AplListItem } from '@features/apl/components/AplListItem';
import { AplNameDialog } from '@features/apl/components/AplNameDialog';
import { FloatingActionBar } from '@features/apl/components/FloatingActionBar';
import { ListItemHeader } from '@features/apl/components/ListItemHeader';
import { uuidValidations } from '@features/apl/components/ListItemHeader/utils';
import { useVariableExtraction } from '@features/apl/hooks/useVariableExtraction';
import { rotationSource } from '@features/apl/utils';
import { APLListItem } from '@generated/proto/apl';
import i18n from '@i18n/config';
import { usePlayer } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import { ListPicker, type ListPickerConfig } from '@ui-kit/ListPicker';

const itemLabel = () => i18n.t('rotation_tab.apl.priorityList.name');

/**
 * The rotation's priority list.
 *
 * `sameGroupOnly` is what keeps its rows from being dragged into a group's action list and back.
 */
export const PriorityList = () => {
	const player = usePlayer();
	const extraction = useVariableExtraction(
		player,
		index => player.aplRotation.priorityList[index]?.action?.condition,
		(index, reference) => {
			player.aplRotation.priorityList[index].action!.condition = reference;
		},
	);

	const config: ListPickerConfig<Player<any>, APLListItem> = {
		title: i18n.t('rotation_tab.apl.priorityList.header'),
		titleTooltip: i18n.t('rotation_tab.apl.priorityList.tooltips.overview'),
		extraClassNames: ['apl-list-item-picker'],
		itemLabel: itemLabel(),
		storeSubscribe: rotationSource,
		getValue: (subject: Player<any>) => subject.aplRotation.priorityList,
		setValue: (subject: Player<any>, next: Array<APLListItem>) =>
			subject.modifyAplRotation(rotation => {
				rotation.priorityList = next;
			}),
		newItem: () => APLListItem.create({ action: {} }),
		copyItem: (oldItem: APLListItem) => APLListItem.clone(oldItem),
		allowedActions: ['copy', 'delete', 'move'],
		inlineMenuBar: true,
		sameGroupOnly: true,
		extraActions: [extraction.extraAction],
	};

	return (
		<div className="apl-priority-list-picker-root">
			<ListPicker<Player<any>, APLListItem>
				modObject={player}
				config={config}
				renderItem={(_index, itemConfig) => <AplListItem player={player} config={itemConfig} />}
				renderItemHeader={index => (
					<ListItemHeader
						player={player}
						getItem={subject => subject.aplRotation.priorityList[index]}
						getValidations={subject => [
							...(subject.getCurrentStats().rotationStats?.priorityList[index]?.validations || []),
							...uuidValidations(subject, subject.aplRotation.priorityList[index]?.action?.condition?.uuid?.value),
						]}
					/>
				)}
			/>
			<FloatingActionBar
				itemName={itemLabel()}
				onCreate={() => player.modifyAplRotation(rotation => rotation.priorityList.push(APLListItem.create({ action: {} })))}
			/>
			<AplNameDialog {...extraction.dialog} />
		</div>
	);
};
