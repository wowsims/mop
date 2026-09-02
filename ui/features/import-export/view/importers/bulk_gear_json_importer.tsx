import { Database } from '@domain/proto_utils/database';
import type { IndividualSimHost } from '@features/sim_host';
import { EquipmentSpec, Spec } from '@generated/proto/common';
import { t } from 'i18next';

import { BulkTab } from '../../../bulk/view/bulk_tab';
import { IndividualImporter } from './individual_importer';

export class BulkGearJsonImporter<SpecType extends Spec> extends IndividualImporter<SpecType> {
	private readonly bulkUI: BulkTab;

	constructor(parent: HTMLElement, simUI: IndividualSimHost<any>, bulkUI: BulkTab) {
		super(parent, simUI, { title: t('bulk_tab.import_modal.title'), allowFileUpload: true });

		this.bulkUI = bulkUI;
		this.descriptionElem.appendChild(
			<>
				<p>{t('bulk_tab.import_modal.description_line1')}</p>
				<p>{t('bulk_tab.import_modal.description_line2')}</p>
			</>,
		);
	}

	async onImport(data: string) {
		try {
			const equipment = EquipmentSpec.fromJsonString(data, { ignoreUnknownFields: true });
			if (equipment?.items?.length > 0) {
				const db = await Database.loadLeftoversIfNecessary(equipment);
				const items = equipment.items.filter(spec => spec.id > 0 && db.lookupItemSpec(spec));
				if (items.length > 0) {
					this.bulkUI.addItems(items);
				}
			}
			this.close();
		} catch (e: any) {
			console.warn(e);
			alert(e.toString());
		}
	}
}
