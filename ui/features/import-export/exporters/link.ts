import { arrayEquals } from '@domain/collections';
import { SIM_CATEGORY_KEYS, SimSettingCategories } from '@domain/constants/sim_settings';
import { LINK_CATEGORY_PARAM, LINK_DEFAULT_CATEGORIES } from '@domain/state/sim_links';
import type { IndividualSimHost } from '@features/sim_host';
import { IndividualSimSettings } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { default as pako } from 'pako';

import { selectedCategories } from './categories';
import type { ExporterDefinition } from './types';

/** Also `IndividualSimUI.toLink()`, which shares the sim by URL with the default categories. */
export const createLink = (host: IndividualSimHost<any>, exportCategories?: Array<SimSettingCategories>): string => {
	if (!exportCategories) {
		exportCategories = LINK_DEFAULT_CATEGORIES;
	}

	const proto = host.toProto(exportCategories);

	const protoBytes = IndividualSimSettings.toBinary(proto);
	// @ts-ignore Pako did some weird stuff between versions and the @types package doesn't correctly support this syntax for version 2.0.4 but it's completely valid
	// The syntax was removed in 2.1.0 and there were several complaints but the project seems to be largely abandoned now
	const deflated = pako.deflate(protoBytes, { to: 'string' });
	const encoded = btoa(String.fromCharCode(...deflated));

	const linkUrl = new URL(window.location.href);
	linkUrl.hash = encoded;
	if (arrayEquals(exportCategories, LINK_DEFAULT_CATEGORIES)) {
		linkUrl.searchParams.delete(LINK_CATEGORY_PARAM);
	} else {
		const categoryCharString = exportCategories.map(c => SIM_CATEGORY_KEYS.get(c)).join('');
		linkUrl.searchParams.set(LINK_CATEGORY_PARAM, categoryCharString);
	}
	return linkUrl.toString();
};

export const LINK_EXPORTER: ExporterDefinition = {
	title: i18n.t('export.link.title'),
	selectCategories: true,
	getData: (host, categories) => createLink(host, selectedCategories(categories)),
};
