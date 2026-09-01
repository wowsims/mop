import i18n from '../../../i18n/config';
import { sourceFilterI18nKeys } from '../../../i18n/entity_mapping';
import { translateArmorType, translateRaidFilter, translateRangedWeaponType,translateSourceFilter, translateWeaponType } from '../../../i18n/localization';
import { Player } from '../../player';
import { ItemSlot } from '../../proto/common';
import { SourceFilterOption, UIItem_FactionRestriction } from '../../proto/ui';
import { Sim } from '../../sim';
import { EventID } from '../../state/batch';
import { subscribeSimField } from '../../state/subscriptions';
import { BaseModal } from '../base_modal';
import { BooleanPicker } from '../pickers/boolean_picker';
import { EnumPicker } from '../pickers/enum_picker';
import { NumberPicker } from '../pickers/number_picker';
const factionRestrictionsToLabels: Record<UIItem_FactionRestriction, string> = {
	[UIItem_FactionRestriction.UNSPECIFIED]: i18n.t('gear_tab.gear_picker.filters.faction_labels.none'),
	[UIItem_FactionRestriction.ALLIANCE_ONLY]: i18n.t('gear_tab.gear_picker.filters.faction_labels.alliance_only'),
	[UIItem_FactionRestriction.HORDE_ONLY]: i18n.t('gear_tab.gear_picker.filters.faction_labels.horde_only'),
};

export class FiltersMenu extends BaseModal {
	constructor(rootElem: HTMLElement, player: Player<any>, slot: ItemSlot) {
		super(rootElem, 'filters-menu', { size: 'md', title: i18n.t('gear_tab.gear_picker.filters.title'), disposeOnClose: false });

		const generalSection = this.newSection(i18n.t('gear_tab.gear_picker.filters.general'));

		const ilvlFiltersContainer = (<div className="ilvl-filters" />) as HTMLElement;
		generalSection.appendChild(ilvlFiltersContainer);

		new NumberPicker(ilvlFiltersContainer, player.sim, {
			id: 'filters-min-ilvl',
			label: i18n.t('gear_tab.gear_picker.filters.min_ilvl'),
			showZeroes: false,
			storeSubscribe: (sim: Sim, onChange: () => void) => subscribeSimField(sim, 'filters')(onChange),
			getValue: (sim: Sim) => sim.getFilters().minIlvl,
			setValue: (eventID: EventID, sim: Sim, newValue: number) => {
				const newFilters = sim.getFilters();
				newFilters.minIlvl = newValue;
				sim.setFilters(eventID, newFilters);
			},
		});

		ilvlFiltersContainer.appendChild(<span className="ilvl-filters-separator">-</span>);

		new NumberPicker(ilvlFiltersContainer, player.sim, {
			id: 'filters-max-ilvl',
			label: i18n.t('gear_tab.gear_picker.filters.max_ilvl'),
			showZeroes: false,
			storeSubscribe: (sim: Sim, onChange: () => void) => subscribeSimField(sim, 'filters')(onChange),
			getValue: (sim: Sim) => sim.getFilters().maxIlvl,
			setValue: (eventID: EventID, sim: Sim, newValue: number) => {
				const newFilters = sim.getFilters();
				newFilters.maxIlvl = newValue;
				sim.setFilters(eventID, newFilters);
			},
		});

		new EnumPicker(generalSection, player.sim, {
			id: 'filters-faction-restriction',
			label: i18n.t('gear_tab.gear_picker.filters.faction_restrictions'),
			values: [UIItem_FactionRestriction.UNSPECIFIED, UIItem_FactionRestriction.ALLIANCE_ONLY, UIItem_FactionRestriction.HORDE_ONLY].map(restriction => {
				return {
					name: factionRestrictionsToLabels[restriction],
					value: restriction,
				};
			}),
			storeSubscribe: (sim: Sim, onChange: () => void) => subscribeSimField(sim, 'filters')(onChange),
			getValue: (sim: Sim) => sim.getFilters().factionRestriction,
			setValue: (eventID: EventID, sim: Sim, newValue: UIItem_FactionRestriction) => {
				const newFilters = sim.getFilters();
				newFilters.factionRestriction = newValue;
				sim.setFilters(eventID, newFilters);
			},
		});

		const sourceSection = this.newSection(i18n.t('gear_tab.gear_picker.filters.source'));
		sourceSection.classList.add('filters-menu-section-bool-list');
		const sourceKeys = Object.keys(sourceFilterI18nKeys) as unknown as SourceFilterOption[];
		Sim.ALL_SOURCES.sort((a, b) => {
			const aIndex = sourceKeys.indexOf(a);
			const bIndex = sourceKeys.indexOf(b);
			return aIndex - bIndex;
		}).forEach(source => {
			const label = translateSourceFilter(source);
			if (!label) return;
			new BooleanPicker<Sim>(sourceSection, player.sim, {
				id: `filters-source-${source}`,
				label,
				inline: true,
				storeSubscribe: (sim: Sim, onChange: () => void) => subscribeSimField(sim, 'filters')(onChange),
				getValue: (sim: Sim) => sim.getFilters().sources.includes(source),
				setValue: (eventID: EventID, sim: Sim, newValue: boolean) => {
					const filters = sim.getFilters();
					if (newValue) {
						filters.sources.push(source);
					} else {
						filters.sources = filters.sources.filter(v => v != source);
					}
					sim.setFilters(eventID, filters);
				},
			});
		});

		const raidsSection = this.newSection(i18n.t('gear_tab.gear_picker.filters.raids'));
		raidsSection.classList.add('filters-menu-section-bool-list');
		Sim.ALL_RAIDS.forEach(raid => {
			new BooleanPicker<Sim>(raidsSection, player.sim, {
				id: `filters-raid-${raid}`,
				label: translateRaidFilter(raid),
				inline: true,
				storeSubscribe: (sim: Sim, onChange: () => void) => subscribeSimField(sim, 'filters')(onChange),
				getValue: (sim: Sim) => sim.getFilters().raids.includes(raid),
				setValue: (eventID: EventID, sim: Sim, newValue: boolean) => {
					const filters = sim.getFilters();
					if (newValue) {
						filters.raids.push(raid);
					} else {
						filters.raids = filters.raids.filter(v => v != raid);
					}
					sim.setFilters(eventID, filters);
				},
			});
		});

		if (Player.ARMOR_SLOTS.includes(slot)) {
			const armorTypes = player.getPlayerClass().armorTypes;

			if (armorTypes.length > 1) {
				const armorTypesSection = this.newSection(i18n.t('gear_tab.gear_picker.armor_type'));
				armorTypesSection.classList.add('filters-menu-section-bool-list');

				armorTypes.forEach(armorType => {
					new BooleanPicker<Sim>(armorTypesSection, player.sim, {
						id: `filters-armor-type-${armorType}`,
						label: translateArmorType(armorType),
						inline: true,
						storeSubscribe: (sim: Sim, onChange: () => void) => subscribeSimField(sim, 'filters')(onChange),
						getValue: (sim: Sim) => sim.getFilters().armorTypes.includes(armorType),
						setValue: (eventID: EventID, sim: Sim, newValue: boolean) => {
							const filters = sim.getFilters();
							if (newValue) {
								filters.armorTypes.push(armorType);
							} else {
								filters.armorTypes = filters.armorTypes.filter(at => at != armorType);
							}
							sim.setFilters(eventID, filters);
						},
					});
				});
			}
		} else if (Player.WEAPON_SLOTS.includes(slot)) {
			if (player.getPlayerClass().weaponTypes.length > 0) {
				const weaponTypeSection = this.newSection(i18n.t('gear_tab.gear_picker.weapon_type'));
				weaponTypeSection.classList.add('filters-menu-section-bool-list');
				const weaponTypes = player.getPlayerClass().weaponTypes.map(ewt => ewt.weaponType);

				weaponTypes.forEach(weaponType => {
					new BooleanPicker<Sim>(weaponTypeSection, player.sim, {
						id: `filters-weapon-type-${weaponType}`,
						label: translateWeaponType(weaponType),
						inline: true,
						storeSubscribe: (sim: Sim, onChange: () => void) => subscribeSimField(sim, 'filters')(onChange),
						getValue: (sim: Sim) => sim.getFilters().weaponTypes.includes(weaponType),
						setValue: (eventID: EventID, sim: Sim, newValue: boolean) => {
							const filters = sim.getFilters();
							if (newValue) {
								filters.weaponTypes.push(weaponType);
							} else {
								filters.weaponTypes = filters.weaponTypes.filter(at => at != weaponType);
							}
							sim.setFilters(eventID, filters);
						},
					});
				});

				const weaponSpeedSection = this.newSection(i18n.t('gear_tab.gear_picker.weapon_speed'));
				weaponSpeedSection.classList.add('filters-menu-section-number-list');
				new NumberPicker<Sim>(weaponSpeedSection, player.sim, {
					id: 'filters-min-weapon-speed',
					label: i18n.t('gear_tab.gear_picker.min_mh_speed'),
					//labelTooltip: 'Maximum speed for the mainhand weapon. If 0, no maximum value is applied.',
					float: true,
					positive: true,
					storeSubscribe: (sim: Sim, onChange: () => void) => subscribeSimField(sim, 'filters')(onChange),
					getValue: (sim: Sim) => sim.getFilters().minMhWeaponSpeed,
					setValue: (eventID: EventID, sim: Sim, newValue: number) => {
						const filters = sim.getFilters();
						filters.minMhWeaponSpeed = newValue;
						sim.setFilters(eventID, filters);
					},
				});
				new NumberPicker<Sim>(weaponSpeedSection, player.sim, {
					id: 'filters-max-weapon-speed',
					label: i18n.t('gear_tab.gear_picker.max_mh_speed'),
					//labelTooltip: 'Maximum speed for the mainhand weapon. If 0, no maximum value is applied.',
					float: true,
					positive: true,
					storeSubscribe: (sim: Sim, onChange: () => void) => subscribeSimField(sim, 'filters')(onChange),
					getValue: (sim: Sim) => sim.getFilters().maxMhWeaponSpeed,
					setValue: (eventID: EventID, sim: Sim, newValue: number) => {
						const filters = sim.getFilters();
						filters.maxMhWeaponSpeed = newValue;
						sim.setFilters(eventID, filters);
					},
				});

				if (player.getPlayerSpec().canDualWield) {
					new NumberPicker<Sim>(weaponSpeedSection, player.sim, {
						id: 'filters-min-oh-weapon-speed',
						label: i18n.t('gear_tab.gear_picker.min_oh_speed'),
						//labelTooltip: 'Minimum speed for the offhand weapon. If 0, no minimum value is applied.',
						float: true,
						positive: true,
						storeSubscribe: (sim: Sim, onChange: () => void) => subscribeSimField(sim, 'filters')(onChange),
						getValue: (sim: Sim) => sim.getFilters().minOhWeaponSpeed,
						setValue: (eventID: EventID, sim: Sim, newValue: number) => {
							const filters = sim.getFilters();
							filters.minOhWeaponSpeed = newValue;
							sim.setFilters(eventID, filters);
						},
					});
					new NumberPicker<Sim>(weaponSpeedSection, player.sim, {
						id: 'filters-max-oh-weapon-speed',
						label: i18n.t('gear_tab.gear_picker.max_oh_speed'),
						//labelTooltip: 'Maximum speed for the offhand weapon. If 0, no maximum value is applied.',
						float: true,
						positive: true,
						storeSubscribe: (sim: Sim, onChange: () => void) => subscribeSimField(sim, 'filters')(onChange),
						getValue: (sim: Sim) => sim.getFilters().maxOhWeaponSpeed,
						setValue: (eventID: EventID, sim: Sim, newValue: number) => {
							const filters = sim.getFilters();
							filters.maxOhWeaponSpeed = newValue;
							sim.setFilters(eventID, filters);
						},
					});
				}
			}

			const rangedweapontypes = player.getPlayerClass().rangedWeaponTypes;
			if (rangedweapontypes.length < 1) {
				return;
			}
			const rangedWeaponTypeSection = this.newSection(i18n.t('gear_tab.gear_picker.ranged_weapon_type'));
			rangedWeaponTypeSection.classList.add('filters-menu-section-bool-list');

			rangedweapontypes.forEach(rangedWeaponType => {
				new BooleanPicker<Sim>(rangedWeaponTypeSection, player.sim, {
					id: `filter-ranged-weapon-type-${rangedWeaponType}`,
					label: translateRangedWeaponType(rangedWeaponType),
					inline: true,
					storeSubscribe: (sim: Sim, onChange: () => void) => subscribeSimField(sim, 'filters')(onChange),
					getValue: (sim: Sim) => sim.getFilters().rangedWeaponTypes.includes(rangedWeaponType),
					setValue: (eventID: EventID, sim: Sim, newValue: boolean) => {
						const filters = sim.getFilters();
						if (newValue) {
							filters.rangedWeaponTypes.push(rangedWeaponType);
						} else {
							filters.rangedWeaponTypes = filters.rangedWeaponTypes.filter(at => at != rangedWeaponType);
						}
						sim.setFilters(eventID, filters);
					},
				});
			});

			const rangedWeaponSpeedSection = this.newSection(i18n.t('gear_tab.gear_picker.ranged_weapon_speed'));
			rangedWeaponSpeedSection.classList.add('filters-menu-section-number-list');
			new NumberPicker<Sim>(rangedWeaponSpeedSection, player.sim, {
				id: 'filters-min-ranged-weapon-speed',
				label: i18n.t('gear_tab.gear_picker.min_ranged_speed'),
				//labelTooltip: 'Maximum speed for the ranged weapon. If 0, no maximum value is applied.',
				float: true,
				positive: true,
				storeSubscribe: (sim: Sim, onChange: () => void) => subscribeSimField(sim, 'filters')(onChange),
				getValue: (sim: Sim) => sim.getFilters().minRangedWeaponSpeed,
				setValue: (eventID: EventID, sim: Sim, newValue: number) => {
					const filters = sim.getFilters();
					filters.minRangedWeaponSpeed = newValue;
					sim.setFilters(eventID, filters);
				},
			});
			new NumberPicker<Sim>(rangedWeaponSpeedSection, player.sim, {
				id: 'filters-max-ranged-weapon-speed',
				label: i18n.t('gear_tab.gear_picker.max_ranged_speed'),
				//labelTooltip: 'Maximum speed for the ranged weapon. If 0, no maximum value is applied.',
				float: true,
				positive: true,
				storeSubscribe: (sim: Sim, onChange: () => void) => subscribeSimField(sim, 'filters')(onChange),
				getValue: (sim: Sim) => sim.getFilters().maxRangedWeaponSpeed,
				setValue: (eventID: EventID, sim: Sim, newValue: number) => {
					const filters = sim.getFilters();
					filters.maxRangedWeaponSpeed = newValue;
					sim.setFilters(eventID, filters);
				},
			});
		}
	}

	private newSection(name: string): HTMLElement {
		const section = document.createElement('div');
		section.classList.add('menu-section', `${name.toLowerCase().replaceAll(' ', '-')}-section`);
		this.body.appendChild(section);
		section.innerHTML = `
			<div class="menu-section-header">
				<h6 class="menu-section-title">${name}</h6>
			</div>
			<div class="menu-section-content"></div>
		`;
		return section.getElementsByClassName('menu-section-content')[0] as HTMLElement;
	}
}
