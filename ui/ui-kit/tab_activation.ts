import { createContext, useContext } from 'react';

// Which tab is open is `SimTabs`' own state; this is how a pane's contents open a sibling tab.
export const TabActivationContext = createContext<(id: string) => void>(() => {
	throw new Error('useActivateTab must be used inside <SimTabs>');
});

export const useActivateTab = (): ((id: string) => void) => useContext(TabActivationContext);
