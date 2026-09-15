import { createContext, useContext } from 'react';

export const DrStickySlotContext = createContext<HTMLElement | null>(null);

export const useDrStickySlot = (): HTMLElement | null => useContext(DrStickySlotContext);
