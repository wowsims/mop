import type { SimSettingCategories } from '@domain/constants/sim_settings';
import { LINK_DEFAULT_CATEGORIES } from '@domain/state/sim_links';
import { jsonStringifyWithFlattenedPaths } from '@domain/utils';
import type { IndividualSimHost } from '@features/sim_host';
import { IndividualSimSettings } from '@generated/proto/ui';
import i18n from '@i18n/config';

import { selectedCategories } from './categories';
import type { ExporterDefinition } from './types';

export const createSettingsJson = (host: IndividualSimHost<any>, exportCategories?: Array<SimSettingCategories>): string => {
	if (!exportCategories) {
		exportCategories = LINK_DEFAULT_CATEGORIES;
	}

	return jsonStringifyWithFlattenedPaths(IndividualSimSettings.toJson(host.toProto(exportCategories)), 2, (value, path) => {
		if (['stats', 'pseudoStats', 'itemSwap'].includes(path[path.length - 1])) {
			return true;
		}

		if (['player', 'equipment', 'items'].every((v, i) => path[i] == v)) {
			return path.length > 3;
		}

		if (path[0] == 'player' && path[1] == 'rotation' && ['prepullActions', 'priorityList', 'groups', 'valueVariables'].includes(path[2])) {
			return path.length > 3;
		}

		return false;
	});
};

export const JSON_EXPORTER: ExporterDefinition = {
	title: i18n.t('export.json.title'),
	allowDownload: true,
	selectCategories: true,
	getData: (host, categories) => createSettingsJson(host, selectedCategories(categories)),
};
