/** @jsxImportSource @jsx-vanilla */
import { EquipmentSpec } from '@generated/proto/common';
import { Database } from '@sim/proto/database';
import type { IndividualSimHost } from '@sim/sim_host';
import { t } from 'i18next';

import { BulkTab } from '../../../bulk/view/bulk_tab';
import { Importer } from '../importer';

export class BulkGearJsonImporter extends Importer {
	protected readonly simUI: IndividualSimHost<any>;
	private readonly bulkUI: BulkTab;

	constructor(parent: HTMLElement, simUI: IndividualSimHost<any>, bulkUI: BulkTab) {
		super(parent, { title: t('bulk_tab.import_modal.title'), allowFileUpload: true });

		this.simUI = simUI;
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
