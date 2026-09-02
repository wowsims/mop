import { SimSettingCategories } from '@domain/constants/sim_settings';
import { EventID } from '@domain/state/batch';
import { getEnumValues } from '@domain/utils';
import { BooleanPicker } from '@ui-kit/pickers/boolean_picker';

import i18n from '../../../../i18n/config';
import { IndividualSimUI } from '../../../individual_sim_ui';
import { Spec } from '../../../proto/common';
import { Exporter, ExporterOptions } from '../../exporter';
import { IndividualImporter } from '../importers/individual_importer';
interface IndividualExporterOptions extends ExporterOptions {
	selectCategories?: boolean;
}

export abstract class IndividualExporter<SpecType extends Spec> extends Exporter {
	protected static readonly exportPickerConfigs: Array<{
		category: SimSettingCategories;
		label: string;
		labelTooltip: string;
	}> = [
		{
			category: SimSettingCategories.Gear,
			label: i18n.t('export.categories.gear.label'),
			labelTooltip: i18n.t('export.categories.gear.tooltip'),
		},
		{
			category: SimSettingCategories.Talents,
			label: i18n.t('export.categories.talents.label'),
			labelTooltip: i18n.t('export.categories.talents.tooltip'),
		},
		{
			category: SimSettingCategories.Rotation,
			label: i18n.t('export.categories.rotation.label'),
			labelTooltip: i18n.t('export.categories.rotation.tooltip'),
		},
		{
			category: SimSettingCategories.Consumes,
			label: i18n.t('export.categories.consumes.label'),
			labelTooltip: i18n.t('export.categories.consumes.tooltip'),
		},
		{
			category: SimSettingCategories.External,
			label: i18n.t('export.categories.external.label'),
			labelTooltip: i18n.t('export.categories.external.tooltip'),
		},
		{
			category: SimSettingCategories.Miscellaneous,
			label: i18n.t('export.categories.miscellaneous.label'),
			labelTooltip: i18n.t('export.categories.miscellaneous.tooltip'),
		},
		{
			category: SimSettingCategories.Encounter,
			label: i18n.t('export.categories.encounter.label'),
			labelTooltip: i18n.t('export.categories.encounter.tooltip'),
		},
		// Intentionally exclude UISettings category here, because users almost
		// never intend to export them and it messes with other users' settings.
		// If they REALLY want to export UISettings, just use the JSON exporter.
	];
	protected readonly simUI: IndividualSimUI<SpecType>;
	protected readonly exportCategories: Record<SimSettingCategories, boolean>;

	constructor(parent: HTMLElement, simUI: IndividualSimUI<SpecType>, options: IndividualExporterOptions) {
		super(parent, options as ExporterOptions);

		this.simUI = simUI;
		const exportCategories: Partial<Record<SimSettingCategories, boolean>> = {};
		(getEnumValues(SimSettingCategories) as Array<SimSettingCategories>).forEach(
			cat => (exportCategories[cat] = IndividualImporter.DEFAULT_CATEGORIES.includes(cat)),
		);
		this.exportCategories = exportCategories as Record<SimSettingCategories, boolean>;

		if (options.selectCategories) {
			const categoryPickerContainer = (<div className="exporter-category-pickers" />) as HTMLElement;
			this.body.prepend(categoryPickerContainer);

			IndividualExporter.exportPickerConfigs.forEach(exportConfig => {
				const category = exportConfig.category;
				new BooleanPicker(categoryPickerContainer, this, {
					id: `link-exporter-${category}`,
					label: exportConfig.label,
					labelTooltip: exportConfig.labelTooltip,
					inline: true,
					getValue: () => this.exportCategories[category],
					setValue: (eventID: EventID, _modObj: IndividualExporter<SpecType>, newValue: boolean) => {
						this.exportCategories[category] = newValue;
						this.changeEmitter.emit();
					},
					storeSubscribe: () => this.changeEmitter.on,
				});
			});
		}
	}
}
