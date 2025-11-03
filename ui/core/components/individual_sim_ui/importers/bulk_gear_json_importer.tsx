import { IndividualSimUI } from '../../../individual_sim_ui';
import { EquipmentSpec, Spec } from '../../../proto/common';
import { Database } from '../../../proto_utils/database';
import { BulkTab } from '../bulk_tab';
import { IndividualImporter } from './individual_importer';
import { t } from 'i18next';

export class BulkGearJsonImporter<SpecType extends Spec> extends IndividualImporter<SpecType> {
	private readonly bulkUI: BulkTab;

	constructor(parent: HTMLElement, simUI: IndividualSimUI<any>, bulkUI: BulkTab) {
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
