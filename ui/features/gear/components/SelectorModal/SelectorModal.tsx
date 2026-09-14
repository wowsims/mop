import { Tabs } from '@base-ui/react/tabs';
import type { ItemSlot } from '@generated/proto/common';
import i18n from '@i18n/config';
import { translateSlotName } from '@i18n/localization';
import { useSimHost } from '@sim/context/SimHostContext';
import { useIsBlacksmithing } from '@sim/hooks/useIsBlacksmithing';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import { subscribePlayerField } from '@sim/state/subscriptions';
import { sanitizeId } from '@sim/utils/format';
import { mod } from '@sim/utils/math';
import { Dialog } from '@ui-kit/Dialog';
import { HelpText } from '@ui-kit/FormControl';
import { Icon } from '@ui-kit/Icon';
import { TabNav } from '@ui-kit/TabNav';
import clsx from 'clsx';
import { type KeyboardEvent, useCallback, useEffect, useMemo, useState } from 'react';

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

	const gear = useStoreSubscribe(subscribePlayerField(player, 'gear'), () => player.getGear());
	const isBlacksmithing = useIsBlacksmithing();
	const challengeMode = useStoreSubscribe(subscribePlayerField(player, 'challengeModeEnabled'), () => player.getChallengeModeEnabled());

	const slot = request?.slot ?? null;
	const gearData = request?.gearData ?? null;
	// Keyed on the slot's stored item, not on the whole gear: `Gear` copies the untouched slots' refs
	// forward, so a change anywhere else leaves this one alone and the tab data is not rebuilt.
	const storedItem = slot !== null ? gear.getEquippedItem(slot) : null;
	// A gear source that is not the player's own — the batch's item pickers — has nothing in `gear`
	// to key on, so its own notification is what says the item moved. An effect rather than
	// `useStoreSubscribe`, which marks its snapshot stale as it subscribes and would rebuild every
	// tab's data a second time on each open.
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
		() => (slot !== null ? eligibilityFor({ player, slot, equippedItem, isBlacksmithing }) : null),
		// oxlint-disable-next-line react-hooks/exhaustive-deps
		[player, slot, equippedItem, isBlacksmithing, challengeMode],
	);

	// The requested tab is resolved once per request; a tab the user picks afterwards is taken as-is.
	// Falling back to the first tab avoids showing an empty body when the tab you were on no longer exists.
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
	// it would still move. On the popup, through `Dialog`'s own prop: Base UI stops keydown
	// propagation there, so a listener anywhere above it never sees the arrow keys.
	const onRailKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		// `open` too: Base UI keeps the popup mounted through its closing transition.
		if (!rail || !open || slot === null) return;
		if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
		const index = ALL_ITEM_SLOTS.indexOf(slot);
		if (index < 0) return;
		event.preventDefault();
		openSlot(ALL_ITEM_SLOTS[mod(index + (event.key === 'ArrowUp' ? -1 : 1), ALL_ITEM_SLOTS.length)]);
	};

	return (
		// `Tabs.Root` has to be a React ancestor of both the strip and the panes, and the dialog takes
		// them as two separate props. `display: contents` keeps the element it renders out of the layout.
		<Tabs.Root
			className="contents"
			data-testid="selector-modal-tabs-root"
			value={activeTab?.label ?? null}
			onValueChange={next => request && setSelected({ sequence: request.sequence, tab: next as SelectorModalTabs })}>
			<Dialog
				open={open}
				onOpenChange={state.setOpen}
				testId="selector-modal"
				size="xl"
				maxWidth="max-w-[min(calc(var(--modal-width-xl)-(--spacing(10))),calc(100vw-(2*var(--modal-margin))-(--spacing(10))))]"
				headerFlush
				onKeyDown={onRailKeyDown}
				headerChildren={
					<>
						{rail && <SlotRail gear={gear} isBlacksmithing={isBlacksmithing} currentSlot={slot} onOpen={openSlot} />}
						<div>
							<h6 className="mb-0" data-testid="selector-modal-title">
								{slot !== null ? (translateSlotName(slot) ?? '') : ''}
							</h6>
							<TabNav
								bordered={false}
								testId="selector-modal-tabs"
								tabs={tabs.map(tab => ({
									id: tab.label,
									label:
										tab.socketIdx === undefined ? (
											getTranslatedTabLabel(tab.label)
										) : (
											<TabGemIcon socketColor={tab.socketColor} gem={equippedItem?.gems[tab.socketIdx] ?? null} />
										),
									tabId: tabId(tab.label),
									ariaControls: paneId(tab.label),
									dataLabel: tab.label,
									buttonClassName: clsx(
										tab.socketIdx !== undefined &&
											'p-0 py-2 px-2 ml-2 -mr-2 flex items-center opacity-70 transition-opacity duration-150 ease-in-out hover:opacity-100 data-active:opacity-100',
									),
								}))}
							/>
						</div>
					</>
				}>
				<div>
					{request &&
						slot !== null &&
						tabs.map(tab => (
							// `active` comes from the selection, not from the panel's transition status: this strip has
							// never staged `show` a frame behind `active`, and a panel reopened while it is still fading
							// out reports `ending` for one frame after it is open again.
							<Tabs.Panel
								key={`${request.sequence}-${tab.label}`}
								value={tab.label}
								id={paneId(tab.label)}
								keepMounted
								className={clsx('fade-in-out p-0', tab.label !== activeTab?.label && 'opacity-0')}
								data-testid="selector-modal-tab-pane"
								data-active={tab.label === activeTab?.label ? '' : undefined}>
								<ItemList tab={tab} slot={slot} equippedItem={equippedItem} />
							</Tabs.Panel>
						))}
				</div>
				<HelpText as="div" className="flex items-center">
					<Icon name="circle-exclamation" size="xl" className="mr-2" />
					<span>
						{i18n.t('gear_tab.gear_picker.missing_gear_message.title')}
						<br />
						{i18n.t('gear_tab.gear_picker.missing_gear_message.description')}
					</span>
				</HelpText>
			</Dialog>
		</Tabs.Root>
	);
};
