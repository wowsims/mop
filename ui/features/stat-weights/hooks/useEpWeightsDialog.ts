import { createContext, useContext } from 'react';

// `SimApp` owns the dialog's open state; the sidebar action and the reforge panel both open it here.
export const OpenEpWeightsContext = createContext<() => void>(() => {
	throw new Error('useOpenEpWeights must be used inside <SimApp>');
});

export const useOpenEpWeights = (): (() => void) => useContext(OpenEpWeightsContext);
