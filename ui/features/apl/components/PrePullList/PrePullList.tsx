import { AplListItem } from '@features/apl/components/AplListItem';
import { ListItemHeader } from '@features/apl/components/ListItemHeader';
import { ValuePicker } from '@features/apl/components/ValuePicker';
import { AplProvider } from '@features/apl/context/AplContext';
import { rotationSource } from '@features/apl/utils';
import { APLPrepullAction, APLValue } from '@generated/proto/apl';
import i18n from '@i18n/config';
import { usePlayer } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import { randomUUID } from '@sim/utils/misc';
import { ListPicker, type ListPickerConfig } from '@ui-kit/ListPicker';

const AT_PULL = () => APLValue.create({ value: { oneofKind: 'const', const: { val: '-1s' } }, uuid: { value: randomUUID() } });

/** The actions taken before the pull, each with the time it happens at. */
export const PrePullList = () => {
	const player = usePlayer();

	const config: ListPickerConfig<Player<any>, APLPrepullAction> = {
		title: i18n.t('rotation_tab.apl.prePullActions.header'),
		titleTooltip: i18n.t('rotation_tab.apl.prePullActions.tooltips.overview'),
		extraCssClasses: ['apl-list-item-picker', 'apl-prepull-action-picker'],
		itemLabel: i18n.t('rotation_tab.apl.prePullActions.name'),
		storeSubscribe: rotationSource,
		getValue: (subject: Player<any>) => subject.aplRotation.prepullActions,
		setValue: (subject: Player<any>, next: Array<APLPrepullAction>) =>
			subject.modifyAplRotation(rotation => {
				rotation.prepullActions = next;
			}),
		newItem: () => APLPrepullAction.create({ action: {}, doAtValue: { value: { oneofKind: 'const', const: { val: '-1s' } } } }),
		copyItem: (oldItem: APLPrepullAction) => APLPrepullAction.clone(oldItem),
		allowedActions: ['create', 'copy', 'delete', 'move'],
		inlineMenuBar: true,
	};

	return (
		<AplProvider isPrepull>
			<div className="apl-pre-pull-list-picker-root">
				<ListPicker<Player<any>, APLPrepullAction>
					modObject={player}
					config={config}
					renderItem={(_index, itemConfig) => (
						<AplListItem
							player={player}
							config={itemConfig}
							leading={
								<ValuePicker
									player={player}
									config={{
										label: i18n.t('rotation_tab.apl.prepull_actions.do_at.label'),
										labelTooltip: i18n.t('rotation_tab.apl.prepull_actions.do_at.tooltip'),
										extraCssClasses: ['apl-prepull-actions-doat'],
										inline: true,
										getValue: () => itemConfig.getValue(player)?.doAtValue,
										setValue: (subject: Player<any>, newValue: APLValue | undefined) => {
											const item = itemConfig.getValue(subject);
											if (!item) return;
											item.doAtValue = newValue || AT_PULL();
											subject.touchRotation();
										},
									}}
								/>
							}
						/>
					)}
					renderItemHeader={index => (
						<ListItemHeader
							player={player}
							getItem={subject => subject.aplRotation.prepullActions[index]}
							getValidations={subject => subject.getCurrentStats().rotationStats?.prepullActions[index]?.validations || []}
						/>
					)}
				/>
			</div>
		</AplProvider>
	);
};
