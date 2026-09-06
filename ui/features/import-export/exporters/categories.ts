import { getEnumValues } from '@domain/collections';
import { SimSettingCategories } from '@domain/constants/sim_settings';
import { LINK_DEFAULT_CATEGORIES } from '@domain/state/sim_links';
import i18n from '@i18n/config';

import type { ExportCategories } from './types';

export const EXPORT_CATEGORY_OPTIONS: ReadonlyArray<{ category: SimSettingCategories; label: string; labelTooltip: string }> = [
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
];

export const defaultExportCategories = (): ExportCategories =>
	Object.fromEntries(
		(getEnumValues(SimSettingCategories) as Array<SimSettingCategories>).map(category => [category, LINK_DEFAULT_CATEGORIES.includes(category)]),
	) as ExportCategories;

export const selectedCategories = (categories: ExportCategories): Array<SimSettingCategories> =>
	(getEnumValues(SimSettingCategories) as Array<SimSettingCategories>).filter(category => categories[category]);
