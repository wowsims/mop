import { ItemQuality } from '@generated/proto/common';
import type { CSSProperties } from 'react';

const itemQualityClassNames: Record<ItemQuality, string> = {
	[ItemQuality.ItemQualityJunk]: 'text-quality-junk',
	[ItemQuality.ItemQualityCommon]: 'text-quality-common',
	[ItemQuality.ItemQualityUncommon]: 'text-quality-uncommon',
	[ItemQuality.ItemQualityRare]: 'text-quality-rare',
	[ItemQuality.ItemQualityEpic]: 'text-quality-epic',
	[ItemQuality.ItemQualityLegendary]: 'text-quality-legendary',
	[ItemQuality.ItemQualityArtifact]: 'text-quality-artifact',
	[ItemQuality.ItemQualityHeirloom]: 'text-quality-heirloom',
};
export const itemQualityClassName = (quality: ItemQuality | null | undefined): string | undefined => (quality ? itemQualityClassNames[quality] : undefined);

/** A `style` object of CSS custom properties. React's `CSSProperties` carries no index signature, so a cast is the only way to hand it one. */
export const cssVars = (vars: Record<string, string>): CSSProperties => vars as CSSProperties;
