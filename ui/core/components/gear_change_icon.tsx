import { Player } from '@domain/player';
import { EquippedItem } from '@domain/proto_utils/equipped_item';
import { getEmptyGemSocketIconUrl } from '@domain/proto_utils/gems';
import { setActionIdBackground, setActionIdWowheadHref, setEquippedItemWowheadData } from '@features/gear/view/action_id_dom';
import { getEmptySlotIconUrl } from '@features/gear/view/utils';
import clsx from 'clsx';
import tippy from 'tippy.js';
import { ref } from 'tsx-vanilla';

import i18n from '../../i18n/config';
import { translateSlotName, translateStat } from '../../i18n/localization';
import { ItemSlot } from '../proto/common';

export const buildGearChangeIcon = (
	player: Player<any>,
	slot: ItemSlot,
	item: EquippedItem | undefined,
	previousItem: EquippedItem | undefined,
): HTMLElement => {
	const slotName = translateSlotName(slot);
	const iconRef = ref<HTMLDivElement>();
	const linkRef = ref<HTMLAnchorElement>();
	const reforgeRef = ref<HTMLDivElement>();
	const socketsContainerRef = ref<HTMLDivElement>();
	const itemElement = (
		<div className="item-picker-root gear-change-icon">
			<div className="gear-change-icon-frame">
				<div
					ref={iconRef}
					className="item-picker-icon-wrapper"
					style={{
						backgroundImage: `url('${getEmptySlotIconUrl(slot)}')`,
					}}
				/>
				<a ref={linkRef} className="gear-change-icon-link" />
				<div ref={reforgeRef} className="gear-change-icon-reforge interactive d-none"></div>
				<div ref={socketsContainerRef} className="item-picker-sockets-container"></div>
			</div>
		</div>
	) as HTMLElement;

	if (item) {
		item.asActionId()
			.fill(undefined)
			.then(filledId => {
				setActionIdBackground(filledId, iconRef.value!);
				setActionIdWowheadHref(filledId, linkRef.value!);
			});
		setEquippedItemWowheadData(player, item, linkRef.value!);

		const previousReforge = previousItem?.reforge;
		const previousGems = previousItem?.gems;

		const { reforge, gems } = item;

		if (reforge || previousReforge) {
			let message: Element;
			if (reforge) {
				const { fromStat, toStat } = reforge;
				const fromText = translateStat(fromStat);
				const toText = translateStat(toStat);
				message = (
					<>
						{fromText} → {toText}
					</>
				);
			} else {
				message = <>{i18n.t('gear_tab.reforge_success.removed_reforge')}</>;
			}

			reforgeRef.value?.classList.remove('d-none');
			tippy(reforgeRef.value!, {
				content: (
					<>
						<strong>{slotName}</strong>
						<br />
						{message}
					</>
				),
			});
		}

		if (gems || previousGems) {
			const changedGems: number[] = [];
			previousItem?.gemSockets.forEach((_, socketIdx) => {
				const previousGem = previousGems ? previousGems[socketIdx] : undefined;
				const currentGem = gems ? gems[socketIdx] : undefined;
				if (previousGem?.id !== currentGem?.id) {
					changedGems.push(socketIdx);
				}
			});

			item.allSocketColors().forEach((socketColor, gemIdx) => {
				const hasChangedSocket = changedGems.includes(gemIdx);
				const socketRef = ref<HTMLDivElement>();
				const gemName = gems[gemIdx]?.name;
				socketsContainerRef.value?.appendChild(
					<div
						ref={socketRef}
						className={clsx('gem-socket-container', hasChangedSocket && 'interactive')}
						style={{
							backgroundImage: `url(${getEmptyGemSocketIconUrl(socketColor)})`,
						}}>
						{hasChangedSocket && (
							<>
								<i className={'d-block fas fa-exclamation-circle'}></i>
							</>
						)}
					</div>,
				);
				if (hasChangedSocket && gemName)
					tippy(socketRef.value!, {
						content: (
							<>
								<strong>
									{slotName} - Socket {gemIdx + 1}
								</strong>
								<br />
								{gemName}
							</>
						),
					});
			});
		}
	}

	return itemElement;
};
