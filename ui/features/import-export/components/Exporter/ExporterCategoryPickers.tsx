import { BooleanPicker } from '@ui-kit/BooleanPicker';
import type { BooleanPickerConfig } from '@ui-kit/pickers/boolean_picker';
import { useMemo } from 'react';

import { EXPORT_CATEGORY_OPTIONS, type ExportCategories } from '../../exporters';

export interface ExporterCategoryPickersProps {
	/** Written in place — the record is the pickers' modObject, and its identity has to hold. */
	categories: ExportCategories;
	/** Rung after a write, because the record is not a store and nothing else says it moved. */
	onChange: () => void;
}

export const ExporterCategoryPickers = ({ categories, onChange }: ExporterCategoryPickersProps) => {
	const configs = useMemo(
		() =>
			EXPORT_CATEGORY_OPTIONS.map((option): BooleanPickerConfig<ExportCategories> => ({
				id: `link-exporter-${option.category}`,
				label: option.label,
				labelTooltip: option.labelTooltip,
				inline: true,
				getValue: current => current[option.category],
				setValue: (current, newValue) => {
					current[option.category] = newValue;
					onChange();
				},
			})),
		[onChange],
	);

	return (
		<div className="exporter-category-pickers">
			{configs.map(config => (
				<BooleanPicker key={config.id} modObject={categories} config={config} />
			))}
		</div>
	);
};
