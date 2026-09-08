import './SelectorModal.scss';

import type { ItemSlot } from '@generated/proto/common';
import i18n from '@i18n/config';
import { translateSlotName } from '@i18n/localization';
import { useSimHost } from '@sim/context/SimHostContext';
import { subscribeAll, subscribePlayerField } from '@sim/state/subscriptions';
import { mod } from '@sim/utils/math';
import { sanitizeId } from '@sim/utils/format';
import { Dialog } from '@ui-kit/Dialog';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import { Icon } from '@ui-kit/Icon';
import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { ALL_ITEM_SLOTS, createGearData } from '../../model/gear_data';
import type { GearSelectorModalOpener } from '../../model/selector_modal_opener';
import { resolveSelectedTab } from '../../model/tab_eligibility';
import { getTranslatedTabLabel, SelectorModalTabs } from '../../types';
import { ItemList } from './ItemList';
import { SlotRail } from './SlotRail';
import { TabGemIcon } from './TabGemIcon';
import { buildSelectorTabs, eligibilityFor } from './utils';

const MODAL_ID = 'gear-picker-selector-modal';
const paneId = (label: SelectorModalTabs) => sanitizeId(`${MODAL_ID}-${label}`);
const tabId = (label: SelectorModalTabs) => `${paneId(label)}-tab`;

export interface SelectorModalProps {
	opener: GearSelectorModalOpener;
}

export const SelectorModal = ({ opener }: SelectorModalProps) => {
	const host = useSimHost();
	const player = host.player;

	const open = useSyncExternalStore(opener.subscribe, opener.isOpen, opener.isOpen);
	const request = useSyncExternalStore(opener.subscribe, opener.getRequest, opener.getRequest);
	const [selected, setSelected] = useState<{ sequence: number; tab: SelectorModalTabs } | null>(null);
	const bodyRef = useRef<HTMLDivElement>(null);

	const gear = useStoreSubscribe(
		useMemo(() => subscribePlayerField(player, 'gear'), [player]),
		() => player.getGear(),
	);
	const isBlacksmithing = useStoreSubscribe(
		useMemo(() => subscribeAll([subscribePlayerField(player, 'profession1'), subscribePlayerField(player, 'profession2')]), [player]),
		() => player.isBlacksmithing(),
	);
	const challengeMode = useStoreSubscribe(
		useMemo(() => subscribePlayerField(player, 'challengeModeEnabled'), [player]),
		() => player.getChallengeModeEnabled(),
	);

	const slot = request?.slot ?? null;
	const gearData = request?.gearData ?? null;
	// Keyed on the slot's stored item, not on the whole gear: `Gear` copies the untouched slots' refs
	// forward, so a change anywhere else leaves this one alone and the tab data is not rebuilt.
	const storedItem = slot !== null ? gear.getEquippedItem(slot) : null;
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const equippedItem = useMemo(() => gearData?.getEquippedItem() ?? null, [gearData, storedItem, challengeMode]);

	const tabs = useMemo(
		() => (gearData && slot !== null ? buildSelectorTabs({ player, slot, gearData, equippedItem, isBlacksmithing }) : []),
		[player, slot, gearData, equippedItem, isBlacksmithing],
	);
	const eligibility = useMemo(
		// eslint-disable-next-line react-hooks/exhaustive-deps
		() => (slot !== null ? eligibilityFor({ player, slot, equippedItem, isBlacksmithing }) : null),
		[player, slot, equippedItem, isBlacksmithing, challengeMode],
	);

	// The requested tab is resolved once per request, the way `setData` did it; a tab the user picks
	// afterwards is taken as-is. Falling back to the first tab is the part vanilla left undone — it
	// showed an empty body when the tab you were on stopped existing.
	const requestedTab = request && eligibility ? resolveSelectedTab(request.tab, eligibility) : SelectorModalTabs.Items;
	const currentTab = selected && request && selected.sequence === request.sequence ? selected.tab : requestedTab;
	const activeTab = tabs.find(tab => tab.label === currentTab) ?? tabs[0] ?? null;

	const openSlot = useCallback(
		(next: ItemSlot) => {
			if (next === slot) return;
			opener.openTab(next, activeTab?.label ?? currentTab, createGearData(player, next));
		},
		[opener, player, slot, activeTab, currentTab],
	);

	// Up and down step the rail's own indices rather than the ItemSlot enum, so a rail with gaps in
	// it would still move. Registered while open only, which is what `onShow`/`addOnHideCallback` did.
	//
	// On the popup, not on `document` where the vanilla modal put it: Base UI stops keydown
	// propagation at the popup, so a document listener sees the arrow keys reach it in the capture
	// phase and never come back. Measured — a listener on `document` never ran, one on the popup did.
	useEffect(() => {
		const popup = bodyRef.current?.closest('.sim-dialog-popup');
		if (!open || slot === null || !popup) return;
		const onKeyDown = (event: Event) => {
			const key = (event as KeyboardEvent).key;
			if (key !== 'ArrowUp' && key !== 'ArrowDown') return;
			const index = ALL_ITEM_SLOTS.indexOf(slot);
			if (index < 0) return;
			event.preventDefault();
			openSlot(ALL_ITEM_SLOTS[mod(index + (key === 'ArrowUp' ? -1 : 1), ALL_ITEM_SLOTS.length)]);
		};
		popup.addEventListener('keydown', onKeyDown);
		return () => popup.removeEventListener('keydown', onKeyDown);
	}, [open, slot, openSlot]);

	return (
		<Dialog
			open={open}
			onOpenChange={opener.setOpen}
			className="selector-modal"
			container={host.rootElem}
			size="xl"
			keepMounted
			headerChildren={
				<>
					<SlotRail gear={gear} isBlacksmithing={isBlacksmithing} currentSlot={slot} onOpen={openSlot} />
					<div>
						<h6 className="selector-modal-title">{slot !== null ? (translateSlotName(slot) ?? '') : ''}</h6>
						<ul className="nav nav-tabs selector-modal-tabs" role="tablist">
							{tabs.map(tab => (
								<li key={tab.label} className="nav-item" role="presentation">
									<button
										type="button"
										id={tabId(tab.label)}
										role="tab"
										aria-selected={tab.label === activeTab?.label}
										aria-controls={paneId(tab.label)}
										data-label={tab.label}
										className={clsx(
											'nav-link selector-modal-item-tab',
											tab.label === activeTab?.label && 'active',
											tab.socketIdx !== undefined && 'selector-modal-tab-gem',
										)}
										onClick={() => request && setSelected({ sequence: request.sequence, tab: tab.label })}>
										{tab.socketIdx === undefined ? (
											getTranslatedTabLabel(tab.label)
										) : (
											<TabGemIcon socketColor={tab.socketColor} gem={equippedItem?.gems[tab.socketIdx] ?? null} />
										)}
									</button>
								</li>
							))}
						</ul>
					</div>
				</>
			}>
			<div ref={bodyRef} className="tab-content selector-modal-tab-content">
				{request &&
					slot !== null &&
					tabs.map(tab => (
						<ItemList
							key={`${request.sequence}-${tab.label}`}
							id={paneId(tab.label)}
							tabId={tabId(tab.label)}
							tab={tab}
							slot={slot}
							equippedItem={equippedItem}
							active={tab.label === activeTab?.label}
						/>
					))}
			</div>
			<div className="d-flex align-items-center form-text">
				<Icon name="circle-exclamation" size="xl" className="me-2" />
				<span>
					{i18n.t('gear_tab.gear_picker.missing_gear_message.title')}
					<br />
					{i18n.t('gear_tab.gear_picker.missing_gear_message.description')}
				</span>
			</div>
		</Dialog>
	);
};
