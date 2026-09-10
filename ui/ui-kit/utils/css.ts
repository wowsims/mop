import { ItemQuality } from '@generated/proto/common';
import type { CSSProperties } from 'react';

const itemQualityClassNames: Record<ItemQuality, string> = {
	[ItemQuality.ItemQualityJunk]: 'text-junk',
	[ItemQuality.ItemQualityCommon]: 'text-common',
	[ItemQuality.ItemQualityUncommon]: 'text-uncommon',
	[ItemQuality.ItemQualityRare]: 'text-rare',
	[ItemQuality.ItemQualityEpic]: 'text-epic',
	[ItemQuality.ItemQualityLegendary]: 'text-legendary',
	[ItemQuality.ItemQualityArtifact]: 'text-artifact',
	[ItemQuality.ItemQualityHeirloom]: 'text-heirloom',
};
export const itemQualityClassName = (quality: ItemQuality | null | undefined): string | undefined => (quality ? itemQualityClassNames[quality] : undefined);

/** A `style` object of CSS custom properties. React's `CSSProperties` carries no index signature, so a cast is the only way to hand it one. */
export const cssVars = (vars: Record<string, string>): CSSProperties => vars as CSSProperties;
