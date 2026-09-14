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
	onAdd: () => void;
}

export const BulkItemSearchRow = ({ item, onAdd }: BulkItemSearchRowProps) => {
	const actionId = ActionId.fromItem(item);
	const { iconUrl, href } = useActionId(actionId);

	return (
		<li>
			<a
				className="ui-bulk-item-search-item text-left no-underline clear-both font-normal text-white rounded-none bg-transparent hover:bg-surface-hover focus:bg-surface-hover active:bg-surface-raised"
				data-item-id={item.id}
				href={href || undefined}
				target="_blank"
				rel={externalRel(href || undefined, undefined)}
				onClick={event => {
					event.preventDefault();
					onAdd();
				}}>
				<div className="flex-shrink-0 size-10 border border-border">
					<span className="ui-item-picker-ilvl" data-testid="item-picker-ilvl">
						{baseIlvl(item)}
					</span>
					<WowheadIcon as="div" className="size-full" testId="bulk-item-search-item-icon" iconUrl={iconUrl} />
				</div>
				<div className="flex flex-col gap-1 pl-2">
					<div className="flex flex-wrap flex-col xxl:flex-row gap-x-1">
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
		</li>
	);
};
