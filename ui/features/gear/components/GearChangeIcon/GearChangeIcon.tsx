import './GearChangeIcon.scss';

import type { ItemSlot } from '@generated/proto/common';
import i18n from '@i18n/config';
import { translateSlotName, translateStat } from '@i18n/localization';
import { useSimHost } from '@sim/context/SimHostContext';
import { useIsBlacksmithing } from '@sim/hooks/useIsBlacksmithing';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { getEmptyGemSocketIconUrl } from '@sim/proto/gems';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { useEquippedItemWowheadDataset } from '@ui-kit/hooks/useEquippedItemWowheadDataset';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { useId, useMemo } from 'react';

import { getEmptySlotIconUrl } from '../../model/empty_slot_icons';
import { gearChangeSockets } from './utils';

export interface GearChangeIconProps {
	slot: ItemSlot;
	/** The slot after the run. Undefined renders the empty frame, which is what an unfilled slot looks like. */
	item?: EquippedItem;
	previousItem?: EquippedItem;
}

/**
 * Parameterises the slot and the before/after pair; fixes the frame, the reforge marker and the
 * per-socket change markers.
 */
export const GearChangeIcon = ({ slot, item, previousItem }: GearChangeIconProps) => {
	const host = useSimHost();
	const player = host.player;
	const slotName = translateSlotName(slot);
	const tooltipId = useId();
	const isBlacksmithing = useIsBlacksmithing();

	const actionId = useMemo(() => item?.asActionId(), [item]);
	const { iconUrl, href } = useActionId(actionId);

	const wowheadProps = useEquippedItemWowheadDataset(player, item, isBlacksmithing);

	const reforge = item?.reforge;
	const showReforge = !!item && (!!reforge || !!previousItem?.reforge);
	const sockets = useMemo(() => gearChangeSockets(item, previousItem), [item, previousItem]);

	return (
		<div className="item-picker-root gear-change-icon">
			<div className="gear-change-icon-frame">
				<div className="item-picker-icon-wrapper" style={{ backgroundImage: `url('${(item && iconUrl) || getEmptySlotIconUrl(slot)}')` }} />
				<a className="gear-change-icon-link" href={item ? href || undefined : undefined} data-whtticon={item ? 'false' : undefined} {...wowheadProps} />
				<div
					className={clsx('gear-change-icon-reforge interactive', !showReforge && 'd-none')}
					{...(showReforge ? tooltipAnchorProps(`${tooltipId}-reforge`) : {})}
				/>
				<div className="item-picker-sockets-container">
					{sockets.map(({ socketColor, gemName, changed }, gemIdx) => (
						<div
							key={gemIdx}
							className={clsx('gem-socket-container', changed && 'interactive')}
							style={{ backgroundImage: `url(${getEmptyGemSocketIconUrl(socketColor)})` }}
							{...(changed && gemName ? tooltipAnchorProps(`${tooltipId}-socket-${gemIdx}`) : {})}>
							{changed && <i className="d-block fas fa-exclamation-circle" />}
						</div>
					))}
				</div>
			</div>
			{showReforge && (
				<Tooltip
					id={`${tooltipId}-reforge`}
					content={
						<>
							<strong>{slotName}</strong>
							<br />
							{reforge
								? `${translateStat(reforge.fromStat)} → ${translateStat(reforge.toStat)}`
								: i18n.t('gear_tab.reforge_success.removed_reforge')}
						</>
					}
				/>
			)}
			{sockets.map(({ gemName, changed }, gemIdx) =>
				changed && gemName ? (
					<Tooltip
						key={gemIdx}
						id={`${tooltipId}-socket-${gemIdx}`}
						content={
							<>
								<strong>
									{slotName} - Socket {gemIdx + 1}
								</strong>
								<br />
								{gemName}
							</>
						}
					/>
				) : null,
			)}
		</div>
	);
};
