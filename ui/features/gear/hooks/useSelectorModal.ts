import type { ItemSlot } from '@generated/proto/common';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { GearData, SelectorModalTabs } from '../types';

export interface SelectorModalRequest {
	slot: ItemSlot;
	tab: SelectorModalTabs;
	gearData: GearData;
	/** Bumped per call, so reopening the same slot on the same tab still resets the panes. */
	sequence: number;
}

export type OpenSelectorModal = (slot: ItemSlot, tab: SelectorModalTabs, gearData: GearData) => void;

export interface SelectorModalState {
	request: SelectorModalRequest | null;
	open: boolean;
	setOpen: (open: boolean) => void;
	openTab: OpenSelectorModal;
}

/** Held by whichever tab body renders the modal; the pickers in that tab open it through the context below. */
export const useSelectorModalState = (): SelectorModalState => {
	const [state, setState] = useState<{ request: SelectorModalRequest | null; open: boolean }>({ request: null, open: false });

	const openTab = useCallback<OpenSelectorModal>(
		(slot, tab, gearData) => setState(prev => ({ request: { slot, tab, gearData, sequence: (prev.request?.sequence ?? 0) + 1 }, open: true })),
		[],
	);
	const setOpen = useCallback((open: boolean) => setState(prev => (prev.open === open ? prev : { ...prev, open })), []);

	return useMemo(() => ({ ...state, openTab, setOpen }), [state, openTab, setOpen]);
};

export const OpenSelectorModalContext = createContext<OpenSelectorModal>(() => {
	throw new Error('useOpenSelectorModal must be used inside a tab that renders <SelectorModal>');
});

export const useOpenSelectorModal = (): OpenSelectorModal => useContext(OpenSelectorModalContext);
