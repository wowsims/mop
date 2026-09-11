import { GearChangeIcon } from '@features/gear/components/GearChangeIcon';
import type { ItemSlot } from '@generated/proto/common';
import i18n from '@i18n/config';
import type { EquippedItem } from '@sim/proto/equipped_item';
import type { Gear } from '@sim/proto/gear';
import { CopyButton } from '@ui-kit/CopyButton';

export interface ReforgeDoneToastProps {
	itemSlots: ItemSlot[];
	/** The slots the run actually moved; every other slot renders its empty frame. */
	changedSlots: Map<ItemSlot, EquippedItem | undefined>;
	previousGear: Gear | null;
	/** `IndividualSimSettings.toJson` output, captured when the toast was raised. */
	settingsExport: unknown;
	onCopied: () => void;
}

export const ReforgeDoneToast = ({ itemSlots, changedSlots, previousGear, settingsExport, onCopied }: ReforgeDoneToastProps) => (
	<>
		<p className="mb-0">{i18n.t('gear_tab.reforge_success.title')}</p>
		<ul className="suggest-reforges-gear-list list-reset">
			{itemSlots.map(slot => (
				<li key={slot}>
					<GearChangeIcon slot={slot} item={changedSlots.get(slot)} previousItem={previousGear?.getEquippedItem(slot) ?? undefined} />
				</li>
			))}
		</ul>
		<div>
			{!!settingsExport && (
				<CopyButton
					className="btn-outline-primary"
					getContent={() => JSON.stringify(settingsExport)}
					text={i18n.t('gear_tab.reforge_success.copy_to_reforge_lite')}
					onCopied={onCopied}
				/>
			)}
		</div>
	</>
);
