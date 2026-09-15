import { AplListItem } from '@features/apl/components/AplListItem';
import { AplListToolbar } from '@features/apl/components/AplListToolbar';
import { AplNameDialog } from '@features/apl/components/AplNameDialog';
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
		extraClassNames: ['ui-apl-list-item-picker', 'peer'],
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
		<div data-testid="apl-priority-list-picker-root">
			<ListPicker<Player<any>, APLListItem>
				modObject={player}
				config={config}
				renderItem={(_index, itemConfig) => <AplListItem player={player} config={itemConfig} />}
				renderItemHeader={(index, itemConfig) => (
					<ListItemHeader
						player={player}
						getItem={itemConfig.getValue}
						getValidations={subject => [
							...(subject.getCurrentStats().rotationStats?.priorityList[index]?.validations || []),
							...uuidValidations(subject, itemConfig.getValue(subject)?.action?.condition?.uuid?.value),
						]}
					/>
				)}
			/>
			<AplListToolbar
				className="peer-has-data-[drag='from']:pointer-events-none peer-has-data-[drag='from']:opacity-50"
				itemName={itemLabel()}
				onCreate={() => player.modifyAplRotation(rotation => rotation.priorityList.push(APLListItem.create({ action: {} })))}
			/>
			<AplNameDialog {...extraction.dialog} />
		</div>
	);
};
