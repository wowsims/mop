import type { CSSProperties } from 'react';

export { itemQualityClassName, toneTextClass } from './colors';

/** A `style` object of CSS custom properties. React's `CSSProperties` carries no index signature, so a cast is the only way to hand it one. */
export const cssVars = (vars: Record<string, string>): CSSProperties => vars as CSSProperties;
