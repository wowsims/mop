import { ItemLevelState, ItemSlot } from '@generated/proto/common';
import i18n from '@i18n/config';
import { translateProtoStatName, translateSlotName, translateStat } from '@i18n/localization';
import { useSimHost } from '@sim/context/SimHostContext';
import { equippedItemWowheadTooltipData } from '@sim/proto/action_id/dom';
import { subscribeAll, subscribePlayerField, subscribeUiField } from '@sim/state/subscriptions';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import { useWowheadDataset } from '@ui-kit/hooks/useWowheadDataset';
import { Tooltip } from '@ui-kit/Tooltip';
import { itemQualityClassName } from '@ui-kit/utils/css';
import clsx from 'clsx';
import { useCallback, useId, useMemo, useRef } from 'react';

import { createGearData } from '../../model/gear_data';
import { SelectorModalTabs } from '../../types';
import { getEmptySlotIconUrl } from '../../view/gear_elements';
import { GemSocket, ItemCell, ItemCellAnchor, NameDescriptionLabel } from '../ItemCell';
import { EnchantLabel } from './EnchantLabel';
import { MISSING_RANDOM_SUFFIX_WARNING } from './item_notices';
import { ItemNoticeIcon } from './ItemNoticeIcon';
import { QuickEnchantList } from './QuickEnchantList';
import { QuickGemList } from './QuickGemList';

export interface ItemPickerCellProps {
	slot: ItemSlot;
	ready: boolean;
}

export const ItemPickerCell = ({ slot, ready }: ItemPickerCellProps) => {
	const host = useSimHost();
	const player = host.player;
	const tooltipId = useId();

	const gearSubscribe = useMemo(() => subscribePlayerField(player, 'gear'), [player]);
	const gear = useStoreSubscribe(gearSubscribe, () => player.getGear());
	const item = gear.getEquippedItem(slot);

	const professionSubscribe = useMemo(
		() => subscribeAll([subscribePlayerField(player, 'profession1'), subscribePlayerField(player, 'profession2')]),
		[player],
	);
	const isBlacksmithing = useStoreSubscribe(professionSubscribe, () => player.isBlacksmithing());

	const quickSwapSubscribe = useMemo(() => subscribeUiField(player.sim, 'showQuickSwap'), [player]);
	const showQuickSwap = useStoreSubscribe(quickSwapSubscribe, () => player.sim.getShowQuickSwap());

	const open = useCallback(
		(tab: SelectorModalTabs) => {
			if (!ready) return;
			host.gearSelectorModal?.openTab(slot, tab, createGearData(player, slot));
		},
		[host, player, slot, ready],
	);

	const iconRef = useRef<HTMLAnchorElement>(null);
	const nameRef = useRef<HTMLAnchorElement>(null);
	const actionId = useMemo(() => item?.asActionId(), [item]);
	const { iconUrl, href } = useActionId(actionId);

	const resolveTooltip = useMemo(() => {
		const equipped = gear.getEquippedItem(slot);
		return equipped ? () => equippedItemWowheadTooltipData(player, equipped, isBlacksmithing) : null;
	}, [player, gear, slot, isBlacksmithing]);
	useWowheadDataset([iconRef, nameRef], resolveTooltip);

	const emptySlotIconUrl = getEmptySlotIconUrl(slot);
	const reforgeData = item?.getReforgeData();

	const quickSwapTooltips =
		!item || !ready ? null : (
			<>
				<Tooltip
					id={`${tooltipId}-enchant`}
					className="tooltip-quick-swap"
					place="bottom"
					clickable
					hidden={!showQuickSwap}
					content={<QuickEnchantList slot={slot} onOpenDetail={() => open(SelectorModalTabs.Enchants)} />}
				/>
				{item.allSocketColors().map((_socketColor, gemIdx) => (
					<Tooltip
						key={gemIdx}
						id={`${tooltipId}-gem-${gemIdx}`}
						className="tooltip-quick-swap"
						place="bottom"
						clickable
						hidden={!showQuickSwap}
						content={<QuickGemList slot={slot} socketIdx={gemIdx} onOpenDetail={() => open(`Gem${gemIdx + 1}` as SelectorModalTabs)} />}
					/>
				))}
			</>
		);

	const sockets =
		item
			?.allSocketColors()
			.map((socketColor, gemIdx) => (
				<GemSocket
					key={gemIdx}
					socketColor={socketColor}
					gem={item.gems[gemIdx] ?? null}
					hidden={gemIdx === item.numPossibleSockets - 1 && item.couldHaveExtraSocket() && !isBlacksmithing}
					onActivate={() => open(`Gem${gemIdx + 1}` as SelectorModalTabs)}
					data-tooltip-id={`${tooltipId}-gem-${gemIdx}`}
				/>
			)) ?? null;

	return (
		<ItemCell
			ilvl={
				item ? (
					<>
						{item.ilvl.toString()}
						{!!(item.upgrade !== ItemLevelState.ChallengeMode && item.ilvlFromBase) && (
							<span className="item-quality-uncommon">+{item.ilvlFromBase}</span>
						)}
					</>
				) : null
			}
			icon={
				<ItemCellAnchor
					ref={iconRef}
					className="item-picker-icon"
					role="button"
					href={href || undefined}
					onActivate={() => open(SelectorModalTabs.Items)}
					data-whtticon={item ? 'false' : undefined}
					style={{ backgroundImage: `url('${(item && iconUrl) || emptySlotIconUrl}')` }}
				/>
			}
			sockets={sockets}
			name={
				<>
					<ItemCellAnchor
						ref={nameRef}
						className={clsx('item-picker-name-container', itemQualityClassName(item?.item.quality))}
						role="button"
						href={href || undefined}
						onActivate={() => open(SelectorModalTabs.Items)}
						data-whtticon={item ? 'false' : undefined}>
						{item ? (
							<>
								<span className="item-picker-name">
									{item.item.name}
									{!!item.randomSuffix && ` ${translateProtoStatName(item.randomSuffix.name)}`}
								</span>
								{!!item.item.nameDescription && <NameDescriptionLabel nameDescription={item.item.nameDescription} />}
							</>
						) : (
							translateSlotName(slot)
						)}
					</ItemCellAnchor>
					{!!item && (
						<ItemNoticeIcon
							itemId={item.item.id}
							additionalNotice={item.hasRandomSuffixOptions() && !item.randomSuffix ? MISSING_RANDOM_SUFFIX_WARNING : undefined}
						/>
					)}
				</>
			}
			labels={
				<>
					<EnchantLabel
						className="item-picker-enchant"
						enchant={item?.enchant}
						onActivate={() => open(SelectorModalTabs.Enchants)}
						tooltipId={`${tooltipId}-enchant`}
					/>
					<EnchantLabel className="item-picker-tinker" enchant={item?.tinker} onActivate={() => open(SelectorModalTabs.Tinkers)} />
					<ItemCellAnchor
						className={clsx('item-picker-reforge', !reforgeData && 'hide')}
						role="button"
						onActivate={() => open(SelectorModalTabs.Reforging)}>
						{reforgeData &&
							i18n.t('gear_tab.gear_picker.reforge_text', {
								fromAmount: Math.abs(reforgeData.fromAmount),
								fromStat: translateStat(reforgeData.reforge?.fromStat),
								toAmount: reforgeData.toAmount,
								toStat: translateStat(reforgeData.reforge?.toStat),
							})}
					</ItemCellAnchor>
					{quickSwapTooltips}
				</>
			}
		/>
	);
};
