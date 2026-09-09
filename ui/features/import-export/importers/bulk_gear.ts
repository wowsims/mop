import { EquipmentSpec } from '@generated/proto/common';
import { Database } from '@sim/proto/database';
import i18n from '@i18n/config';

import type { ImporterDefinition } from './types';

export const BULK_GEAR_IMPORTER: ImporterDefinition = {
	title: i18n.t('bulk_tab.import_modal.title'),
	allowFileUpload: true,
	onImport: async (host, data) => {
		if (!host.bt) throw new Error('The batch tab is not open');
		const equipment = EquipmentSpec.fromJsonString(data, { ignoreUnknownFields: true });
		if (!equipment.items.length) return;

		const db = await Database.loadLeftoversIfNecessary(equipment);
		const items = equipment.items.filter(spec => spec.id > 0 && db.lookupItemSpec(spec));
		if (items.length) host.bt.addItems(items);
	},
};
