import { ItemQuality } from '@generated/proto/common';

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

export const setItemQualityClassName = (elem: HTMLElement, quality: ItemQuality | null) => {
	Object.values(itemQualityClassNames).forEach(cssClass => elem.classList.remove(cssClass));

	if (quality) {
		elem.classList.add(itemQualityClassNames[quality]);
	}
};
