import { createContext, useContext } from 'react';

export const DEFAULT_REFORGE_ID_PREFIX = 'reforge-optimizer';

export const ReforgeIdPrefixContext = createContext(DEFAULT_REFORGE_ID_PREFIX);

export const useReforgeIdPrefix = () => useContext(ReforgeIdPrefixContext);
