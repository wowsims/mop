import { NameDescriptionLabel } from '@features/gear/components/ItemCell';
import { type UIItem, UIItem_FactionRestriction } from '@generated/proto/ui';
import { translateBulkSlotName } from '@i18n/localization';
import { ITEM_SLOT_TO_BULK_SIM_ITEM_SLOT } from '@sim/bulk/utils';
import { ActionId } from '@sim/proto/action_id';
import { getEligibleItemSlots } from '@sim/proto/items';
import { externalRel } from '@sim/utils/links';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { FACTION_TEXT } from '@ui-kit/utils/colors';
import { itemQualityClassName } from '@ui-kit/utils/css';
import { WowheadIcon } from '@ui-kit/WowheadIcon';

import { baseIlvl } from '../../model/search';

export interface BulkItemSearchRowProps {
	item: UIItem;
}

export const BulkItemSearchRow = ({ item }: BulkItemSearchRowProps) => {
	const actionId = ActionId.fromItem(item);
	const { iconUrl, href } = useActionId(actionId);

	return (
		<a
			className="ui-bulk-item-search-item clear-both w-full rounded-none bg-transparent text-left font-normal text-white no-underline"
			data-item-id={item.id}
			href={href || undefined}
			target="_blank"
			tabIndex={-1}
			rel={externalRel(href || undefined, undefined)}
			onClick={event => event.preventDefault()}>
			<div className="relative size-10 shrink-0 border border-border">
				<span className="ui-item-picker-ilvl" data-testid="item-picker-ilvl">
					{baseIlvl(item)}
				</span>
				<WowheadIcon as="div" className="size-full" testId="bulk-item-search-item-icon" iconUrl={iconUrl} />
			</div>
			<div className="flex flex-col gap-1 pl-2">
				<div className="flex flex-col flex-wrap gap-x-1 xxl:flex-row">
					<span className={itemQualityClassName(item.quality)}>{item.name}</span>
					{!!item.nameDescription && <NameDescriptionLabel nameDescription={item.nameDescription} flush />}
					{item.factionRestriction === UIItem_FactionRestriction.HORDE_ONLY && (
						<span className={FACTION_TEXT[UIItem_FactionRestriction.HORDE_ONLY]}>(H)</span>
					)}
					{item.factionRestriction === UIItem_FactionRestriction.ALLIANCE_ONLY && (
						<span className={FACTION_TEXT[UIItem_FactionRestriction.ALLIANCE_ONLY]}>(A)</span>
					)}
				</div>
				<small>{translateBulkSlotName(ITEM_SLOT_TO_BULK_SIM_ITEM_SLOT.get(getEligibleItemSlots(item)[0])!)}</small>
			</div>
		</a>
	);
};
