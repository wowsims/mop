import { Sim } from '@domain/sim';
import { subscribeSimField, subscribeUiField } from '@domain/state/subscriptions';
import i18n from '@i18n/config';
import { BooleanPicker } from '@ui-kit/pickers/boolean_picker';
import { EnumPicker } from '@ui-kit/pickers/enum_picker';
export function makeShow1hWeaponsSelector(parent: HTMLElement, sim: Sim): BooleanPicker<Sim> {
	parent.classList.remove('hide');
	return new BooleanPicker<Sim>(parent, sim, {
		id: 'show-1h-weapons-selector',
		extraCssClasses: ['show-1h-weapons-selector', 'mb-0'],
		label: i18n.t('settings_tab.other.show_1h_weapons.label'),
		inline: true,
		storeSubscribe: (sim: Sim) => subscribeSimField(sim, 'filters'),
		getValue: (sim: Sim) => sim.getFilters().oneHandedWeapons,
		setValue: (sim: Sim, newValue: boolean) => {
			const filters = sim.getFilters();
			filters.oneHandedWeapons = newValue;
			sim.setFilters(filters);
		},
	});
}

export function makeShow2hWeaponsSelector(parent: HTMLElement, sim: Sim): BooleanPicker<Sim> {
	parent.classList.remove('hide');
	return new BooleanPicker<Sim>(parent, sim, {
		id: 'show-2h-weapons-selector',
		extraCssClasses: ['show-2h-weapons-selector', 'mb-0'],
		label: i18n.t('settings_tab.other.show_2h_weapons.label'),
		inline: true,
		storeSubscribe: (sim: Sim) => subscribeSimField(sim, 'filters'),
		getValue: (sim: Sim) => sim.getFilters().twoHandedWeapons,
		setValue: (sim: Sim, newValue: boolean) => {
			const filters = sim.getFilters();
			filters.twoHandedWeapons = newValue;
			sim.setFilters(filters);
		},
	});
}

export function makeShowMatchingGemsSelector(parent: HTMLElement, sim: Sim): BooleanPicker<Sim> {
	return new BooleanPicker<Sim>(parent, sim, {
		id: 'show-matching-gems-selector',
		extraCssClasses: ['show-matching-gems-selector', 'input-inline', 'mb-0'],
		label: i18n.t('settings_tab.other.show_matching_gems.label'),
		inline: true,
		storeSubscribe: (sim: Sim) => subscribeSimField(sim, 'filters'),
		getValue: (sim: Sim) => sim.getFilters().matchingGemsOnly,
		setValue: (sim: Sim, newValue: boolean) => {
			const filters = sim.getFilters();
			filters.matchingGemsOnly = newValue;
			sim.setFilters(filters);
		},
	});
}

export function makeShowEPValuesSelector(parent: HTMLElement, sim: Sim): BooleanPicker<Sim> {
	return new BooleanPicker<Sim>(parent, sim, {
		id: 'show-ep-values-selector',
		extraCssClasses: ['show-ep-values-selector', 'input-inline', 'mb-0'],
		label: i18n.t('settings_tab.other.show_ep_values.label'),
		inline: true,
		storeSubscribe: (sim: Sim) => subscribeUiField(sim, 'showEPValues'),
		getValue: (sim: Sim) => sim.getShowEPValues(),
		setValue: (sim: Sim, newValue: boolean) => {
			sim.setShowEPValues(newValue);
		},
	});
}

export function makePhaseSelector(parent: HTMLElement, sim: Sim): EnumPicker<Sim> {
	return new EnumPicker<Sim>(parent, sim, {
		id: 'phase-selector',
		extraCssClasses: ['phase-selector'],
		values: [
			{ name: i18n.t('common.phases.1'), value: 1 },
			{ name: i18n.t('common.phases.2'), value: 2 },
			{ name: i18n.t('common.phases.3'), value: 3 },
			{ name: i18n.t('common.phases.4'), value: 4 },
			{ name: i18n.t('common.phases.5'), value: 5 },
		],
		storeSubscribe: (sim: Sim) => subscribeSimField(sim, 'phase'),
		getValue: (sim: Sim) => sim.getPhase(),
		setValue: (sim: Sim, newValue: number) => {
			sim.setPhase(newValue);
		},
	});
}
