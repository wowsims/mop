import './SelectorModal.scss';

import type { ItemSlot } from '@generated/proto/common';
import i18n from '@i18n/config';
import { translateSlotName } from '@i18n/localization';
import { useSimHost } from '@sim/context/SimHostContext';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import { subscribeAll, subscribePlayerField } from '@sim/state/subscriptions';
import { sanitizeId } from '@sim/utils/format';
import { mod } from '@sim/utils/math';
import { Dialog } from '@ui-kit/Dialog';
import { Icon } from '@ui-kit/Icon';
import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import type { SelectorModalState } from '../../hooks/useSelectorModal';
import { ALL_ITEM_SLOTS, createGearData } from '../../model/gear_data';
import { resolveSelectedTab } from '../../model/tab_eligibility';
import { getTranslatedTabLabel, SelectorModalTabs } from '../../types';
import { ItemList } from './ItemList';
import { SlotRail } from './SlotRail';
import { TabGemIcon } from './TabGemIcon';
import { buildSelectorTabs, eligibilityFor } from './utils';

const DEFAULT_MODAL_ID = 'gear-picker-selector-modal';

export interface SelectorModalProps {
	state: SelectorModalState;
	/** Prefixes the pane and tab ids, so two instances on one page can be told apart. */
	id?: string;
	/** The rail opens each slot with the *equipped* item, so an instance editing anything else omits it. */
	rail?: boolean;
}

export const SelectorModal = ({ state, id = DEFAULT_MODAL_ID, rail = true }: SelectorModalProps) => {
	const host = useSimHost();
	const player = host.player;
	const paneId = (label: SelectorModalTabs) => sanitizeId(`${id}-${label}`);
	const tabId = (label: SelectorModalTabs) => `${paneId(label)}-tab`;

	const { open, request } = state;
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
	// A gear source that is not the player's own — the batch's item pickers — has nothing in `gear`
	// to key on, so its own notification is what says the item moved. An effect rather than
	// `useStoreSubscribe`, which marks its snapshot stale as it subscribes and would rebuild every
	// tab's data a second time on each open; and only while open, because the dialog is kept mounted.
	const [externalRevision, setExternalRevision] = useState(0);
	useEffect(() => {
		if (!open || !gearData) return;
		return gearData.subscribe(() => setExternalRevision(revision => revision + 1));
	}, [open, gearData]);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const equippedItem = useMemo(() => gearData?.getEquippedItem() ?? null, [gearData, storedItem, challengeMode, externalRevision]);

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
			state.openTab(next, activeTab?.label ?? currentTab, createGearData(player, next));
		},
		[state, player, slot, activeTab, currentTab],
	);

	// Up and down step the rail's own indices rather than the ItemSlot enum, so a rail with gaps in
	// it would still move. Registered while open only, which is what `onShow`/`addOnHideCallback` did.
	//
	// On the popup, not on `document` where the vanilla modal put it: Base UI stops keydown
	// propagation at the popup, so a document listener sees the arrow keys reach it in the capture
	// phase and never come back. Measured — a listener on `document` never ran, one on the popup did.
	useEffect(() => {
		const popup = bodyRef.current?.closest('.sim-dialog-popup');
		if (!rail || !open || slot === null || !popup) return;
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
	}, [rail, open, slot, openSlot]);

	return (
		<Dialog
			open={open}
			onOpenChange={state.setOpen}
			className="selector-modal"
			container={host.rootElem}
			size="xl"
			keepMounted
			headerChildren={
				<>
					{rail && <SlotRail gear={gear} isBlacksmithing={isBlacksmithing} currentSlot={slot} onOpen={openSlot} />}
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
