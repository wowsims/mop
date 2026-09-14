import type { RefObject } from 'react';
import { createContext, useContext } from 'react';

export const DrToolbarContext = createContext<RefObject<HTMLElement | null> | null>(null);

export const useDrToolbar = (): RefObject<HTMLElement | null> | null => useContext(DrToolbarContext);
