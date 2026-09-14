import { ItemLevelState, type ItemSlot } from '@generated/proto/common';
import i18n from '@i18n/config';
import { translateProtoStatName, translateSlotName, translateStat } from '@i18n/localization';
import { usePlayer } from '@sim/context/SimHostContext';
import { useIsBlacksmithing } from '@sim/hooks/useIsBlacksmithing';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { useEquippedItemWowheadDataset } from '@ui-kit/hooks/useEquippedItemWowheadDataset';
import { ItemCell } from '@ui-kit/ItemCell';
import { itemQualityClassName } from '@ui-kit/utils/css';
import type { ClassValue } from 'clsx';
import clsx from 'clsx';
import { type ReactNode, useMemo } from 'react';

import { MISSING_RANDOM_SUFFIX_WARNING } from '../../item_notices';
import { getEmptySlotIconUrl } from '../../model/empty_slot_icons';
import { SelectorModalTabs } from '../../types';
import { EnchantLabel } from '../GearPicker/EnchantLabel';
import { ItemNoticeIcon } from '../GearPicker/ItemNoticeIcon';
import { GemSocket } from './GemSocket';
import { ItemCellAnchor } from './ItemCellAnchor';
import { NameDescriptionLabel } from './NameDescriptionLabel';

export interface ItemDetailCellProps {
	/** Drives the empty-state icon and the empty-state name. */
	slot: ItemSlot;
	item: EquippedItem | null;
	className?: ClassValue;
	/** Omitted for a cell nothing can be picked from — the batch results are read-only. */
	onOpen?: (tab: SelectorModalTabs) => void;
	action?: ReactNode;
	/** Anchors the enchant label at a tooltip — the gear picker's quick-swap popover. */
	enchantTooltipId?: string;
	/** Anchors each socket at one, by socket index. */
	socketTooltipId?: (gemIdx: number) => string;
	/** Rendered after the enchant, tinker and reforge labels. */
	extraLabels?: ReactNode;
	nameDescriptionFlush?: boolean;
	testId?: string;
	rootDataAttributes?: Record<string, string>;
}

/**
 * One equipped item as the gear vocabulary renders it: icon, item level, sockets, name, enchant,
 * tinker and reforge, with the empty state for a slot that holds nothing.
 *
 * Parameterises the item, the slot, what activating a part does and what hangs off the labels and
 * the sockets; fixes the `item-picker-*` markup and the nesting order.
 */
export const ItemDetailCell = ({
	slot,
	item,
	className,
	onOpen,
	action,
	enchantTooltipId,
	socketTooltipId,
	extraLabels,
	nameDescriptionFlush,
	testId,
	rootDataAttributes,
}: ItemDetailCellProps) => {
	const player = usePlayer();

	const isBlacksmithing = useIsBlacksmithing();

	const actionId = useMemo(() => item?.asActionId(), [item]);
	const { iconUrl, href } = useActionId(actionId);
	const wowheadProps = useEquippedItemWowheadDataset(player, item, isBlacksmithing);

	const reforgeData = item?.getReforgeData();

	return (
		<ItemCell
			className={className}
			testId={testId}
			rootDataAttributes={rootDataAttributes}
			ilvl={
				item ? (
					<>
						{item.ilvl.toString()}
						{!!(item.upgrade !== ItemLevelState.ChallengeMode && item.ilvlFromBase) && (
							<span className="text-quality-uncommon">+{item.ilvlFromBase}</span>
						)}
					</>
				) : null
			}
			icon={
				<ItemCellAnchor
					className="ui-item-picker-icon"
					data-testid="item-picker-icon"
					role="button"
					href={href || undefined}
					onActivate={onOpen && (() => onOpen(SelectorModalTabs.Items))}
					data-whtticon={item ? 'false' : undefined}
					style={{ backgroundImage: `url('${(item && iconUrl) || getEmptySlotIconUrl(slot)}')` }}
					{...wowheadProps}
				/>
			}
			sockets={
				item
					?.allSocketColors()
					.map((socketColor, gemIdx) => (
						<GemSocket
							key={gemIdx}
							socketColor={socketColor}
							gem={item.gems[gemIdx] ?? null}
							hidden={gemIdx === item.numPossibleSockets - 1 && item.couldHaveExtraSocket() && !isBlacksmithing}
							onActivate={onOpen && (() => onOpen(`Gem${gemIdx + 1}` as SelectorModalTabs))}
							data-tooltip-id={socketTooltipId?.(gemIdx)}
						/>
					)) ?? null
			}
			name={
				<>
					<ItemCellAnchor
						className={clsx('ui-item-picker-name-container', itemQualityClassName(item?.item.quality))}
						data-testid="item-picker-name-container"
						role="button"
						href={href || undefined}
						onActivate={onOpen && (() => onOpen(SelectorModalTabs.Items))}
						data-whtticon={item ? 'false' : undefined}
						{...wowheadProps}>
						{item ? (
							<>
								<span className="ui-item-picker-name tracking-normal" data-testid="item-picker-name">
									{item.item.name}
									{!!item.randomSuffix && ` ${translateProtoStatName(item.randomSuffix.name)}`}
								</span>
								{!!item.item.nameDescription && (
									<NameDescriptionLabel
										nameDescription={item.item.nameDescription}
										className="tracking-normal"
										flush={nameDescriptionFlush}
									/>
								)}
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
						className="ui-item-picker-label-muted tracking-normal"
						testId="item-picker-enchant"
						enchant={item?.enchant}
						onActivate={onOpen && (() => onOpen(SelectorModalTabs.Enchants))}
						tooltipId={enchantTooltipId}
					/>
					<EnchantLabel
						className="ui-item-picker-label-muted tracking-normal"
						testId="item-picker-tinker"
						enchant={item?.tinker}
						onActivate={onOpen && (() => onOpen(SelectorModalTabs.Tinkers))}
					/>
					{reforgeData && (
						<ItemCellAnchor
							className="ui-item-picker-label-muted tracking-normal"
							data-testid="item-picker-reforge"
							role="button"
							onActivate={onOpen && (() => onOpen(SelectorModalTabs.Reforging))}>
							{i18n.t('gear_tab.gear_picker.reforge_text', {
								fromAmount: Math.abs(reforgeData.fromAmount),
								fromStat: translateStat(reforgeData.reforge?.fromStat),
								toAmount: reforgeData.toAmount,
								toStat: translateStat(reforgeData.reforge?.toStat),
							})}
						</ItemCellAnchor>
					)}
					{extraLabels}
				</>
			}
			action={action}
		/>
	);
};
