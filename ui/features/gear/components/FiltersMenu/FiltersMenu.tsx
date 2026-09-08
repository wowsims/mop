import { ItemSlot } from '@generated/proto/common';
import { SourceFilterOption, UIItem_FactionRestriction } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { sourceFilterI18nKeys } from '@i18n/entity_mapping';
import { translateArmorType, translateRaidFilter, translateRangedWeaponType, translateSourceFilter, translateWeaponType } from '@i18n/localization';
import { useSimHost } from '@sim/context/SimHostContext';
import { Player } from '@sim/player/player';
import { Sim } from '@sim/sim';
import { subscribeSimField } from '@sim/state/subscriptions';
import { kebabCase } from '@sim/utils/format';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import { Dialog } from '@ui-kit/Dialog';
import { EnumPicker } from '@ui-kit/EnumPicker';
import { NumberPicker } from '@ui-kit/NumberPicker';
import clsx, { type ClassValue } from 'clsx';
import type { ReactNode } from 'react';

const factionRestrictionsToLabels: Record<UIItem_FactionRestriction, string> = {
	[UIItem_FactionRestriction.UNSPECIFIED]: i18n.t('gear_tab.gear_picker.filters.faction_labels.none'),
	[UIItem_FactionRestriction.ALLIANCE_ONLY]: i18n.t('gear_tab.gear_picker.filters.faction_labels.alliance_only'),
	[UIItem_FactionRestriction.HORDE_ONLY]: i18n.t('gear_tab.gear_picker.filters.faction_labels.horde_only'),
};

// `Sim.ALL_SOURCES.sort()` sorted the shared static array in place. Both inputs are static, so the
// order is decided once here instead of on every render of a component.
const sourceKeys = Object.keys(sourceFilterI18nKeys) as unknown as SourceFilterOption[];
const SOURCES = [...Sim.ALL_SOURCES].sort((a, b) => sourceKeys.indexOf(a) - sourceKeys.indexOf(b));

const storeSubscribe = (sim: Sim) => subscribeSimField(sim, 'filters');

export interface FiltersMenuProps {
	slot: ItemSlot;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/** `${kebabCase(name)}-section` is vanilla's rule, kept as-is: the class is derived from the *translated* name, so `.general-section` exists in English only. */
const MenuSection = ({ name, className, children }: { name: string; className?: ClassValue; children: ReactNode }) => (
	<div className={clsx('menu-section', `${kebabCase(name)}-section`)}>
		<div className="menu-section-header">
			<h6 className="menu-section-title">{name}</h6>
		</div>
		<div className={clsx('menu-section-content', className)}>{children}</div>
	</div>
);

const SourceSection = ({ sim }: { sim: Sim }) => (
	<MenuSection name={i18n.t('gear_tab.gear_picker.filters.source')} className="filters-menu-section-bool-list">
		{SOURCES.map(source => {
			const label = translateSourceFilter(source);
			if (!label) return null;
			return (
				<BooleanPicker<Sim>
					key={source}
					modObject={sim}
					config={{
						id: `filters-source-${source}`,
						label,
						inline: true,
						storeSubscribe,
						getValue: (sim: Sim) => sim.getFilters().sources.includes(source),
						setValue: (sim: Sim, newValue: boolean) => {
							const filters = sim.getFilters();
							if (newValue) {
								filters.sources.push(source);
							} else {
								filters.sources = filters.sources.filter(v => v != source);
							}
							sim.setFilters(filters);
						},
					}}
				/>
			);
		})}
	</MenuSection>
);

const ArmorTypeSection = ({ player }: { player: Player<any> }) => {
	const armorTypes = player.getPlayerClass().armorTypes;
	if (armorTypes.length <= 1) return null;

	return (
		<MenuSection name={i18n.t('gear_tab.gear_picker.armor_type')} className="filters-menu-section-bool-list">
			{armorTypes.map(armorType => (
				<BooleanPicker<Sim>
					key={armorType}
					modObject={player.sim}
					config={{
						id: `filters-armor-type-${armorType}`,
						label: translateArmorType(armorType),
						inline: true,
						storeSubscribe,
						getValue: (sim: Sim) => sim.getFilters().armorTypes.includes(armorType),
						setValue: (sim: Sim, newValue: boolean) => {
							const filters = sim.getFilters();
							if (newValue) {
								filters.armorTypes.push(armorType);
							} else {
								filters.armorTypes = filters.armorTypes.filter(at => at != armorType);
							}
							sim.setFilters(filters);
						},
					}}
				/>
			))}
		</MenuSection>
	);
};

const WeaponSections = ({ player }: { player: Player<any> }) => {
	const weaponTypes = player.getPlayerClass().weaponTypes.map(ewt => ewt.weaponType);
	if (!weaponTypes.length) return null;

	return (
		<>
			<MenuSection name={i18n.t('gear_tab.gear_picker.weapon_type')} className="filters-menu-section-bool-list">
				{weaponTypes.map(weaponType => (
					<BooleanPicker<Sim>
						key={weaponType}
						modObject={player.sim}
						config={{
							id: `filters-weapon-type-${weaponType}`,
							label: translateWeaponType(weaponType),
							inline: true,
							storeSubscribe,
							getValue: (sim: Sim) => sim.getFilters().weaponTypes.includes(weaponType),
							setValue: (sim: Sim, newValue: boolean) => {
								const filters = sim.getFilters();
								if (newValue) {
									filters.weaponTypes.push(weaponType);
								} else {
									filters.weaponTypes = filters.weaponTypes.filter(at => at != weaponType);
								}
								sim.setFilters(filters);
							},
						}}
					/>
				))}
			</MenuSection>
			<MenuSection name={i18n.t('gear_tab.gear_picker.weapon_speed')} className="filters-menu-section-number-list">
				<NumberPicker<Sim>
					modObject={player.sim}
					config={{
						id: 'filters-min-weapon-speed',
						label: i18n.t('gear_tab.gear_picker.min_mh_speed'),
						float: true,
						positive: true,
						storeSubscribe,
						getValue: (sim: Sim) => sim.getFilters().minMhWeaponSpeed,
						setValue: (sim: Sim, newValue: number) => {
							const filters = sim.getFilters();
							filters.minMhWeaponSpeed = newValue;
							sim.setFilters(filters);
						},
					}}
				/>
				<NumberPicker<Sim>
					modObject={player.sim}
					config={{
						id: 'filters-max-weapon-speed',
						label: i18n.t('gear_tab.gear_picker.max_mh_speed'),
						float: true,
						positive: true,
						storeSubscribe,
						getValue: (sim: Sim) => sim.getFilters().maxMhWeaponSpeed,
						setValue: (sim: Sim, newValue: number) => {
							const filters = sim.getFilters();
							filters.maxMhWeaponSpeed = newValue;
							sim.setFilters(filters);
						},
					}}
				/>
				{player.getPlayerSpec().canDualWield && (
					<>
						<NumberPicker<Sim>
							modObject={player.sim}
							config={{
								id: 'filters-min-oh-weapon-speed',
								label: i18n.t('gear_tab.gear_picker.min_oh_speed'),
								float: true,
								positive: true,
								storeSubscribe,
								getValue: (sim: Sim) => sim.getFilters().minOhWeaponSpeed,
								setValue: (sim: Sim, newValue: number) => {
									const filters = sim.getFilters();
									filters.minOhWeaponSpeed = newValue;
									sim.setFilters(filters);
								},
							}}
						/>
						<NumberPicker<Sim>
							modObject={player.sim}
							config={{
								id: 'filters-max-oh-weapon-speed',
								label: i18n.t('gear_tab.gear_picker.max_oh_speed'),
								float: true,
								positive: true,
								storeSubscribe,
								getValue: (sim: Sim) => sim.getFilters().maxOhWeaponSpeed,
								setValue: (sim: Sim, newValue: number) => {
									const filters = sim.getFilters();
									filters.maxOhWeaponSpeed = newValue;
									sim.setFilters(filters);
								},
							}}
						/>
					</>
				)}
			</MenuSection>
		</>
	);
};

const RangedWeaponSections = ({ player }: { player: Player<any> }) => {
	const rangedWeaponTypes = player.getPlayerClass().rangedWeaponTypes;
	if (!rangedWeaponTypes.length) return null;

	return (
		<>
			<MenuSection name={i18n.t('gear_tab.gear_picker.ranged_weapon_type')} className="filters-menu-section-bool-list">
				{rangedWeaponTypes.map(rangedWeaponType => (
					<BooleanPicker<Sim>
						key={rangedWeaponType}
						modObject={player.sim}
						config={{
							id: `filter-ranged-weapon-type-${rangedWeaponType}`,
							label: translateRangedWeaponType(rangedWeaponType),
							inline: true,
							storeSubscribe,
							getValue: (sim: Sim) => sim.getFilters().rangedWeaponTypes.includes(rangedWeaponType),
							setValue: (sim: Sim, newValue: boolean) => {
								const filters = sim.getFilters();
								if (newValue) {
									filters.rangedWeaponTypes.push(rangedWeaponType);
								} else {
									filters.rangedWeaponTypes = filters.rangedWeaponTypes.filter(at => at != rangedWeaponType);
								}
								sim.setFilters(filters);
							},
						}}
					/>
				))}
			</MenuSection>
			<MenuSection name={i18n.t('gear_tab.gear_picker.ranged_weapon_speed')} className="filters-menu-section-number-list">
				<NumberPicker<Sim>
					modObject={player.sim}
					config={{
						id: 'filters-min-ranged-weapon-speed',
						label: i18n.t('gear_tab.gear_picker.min_ranged_speed'),
						float: true,
						positive: true,
						storeSubscribe,
						getValue: (sim: Sim) => sim.getFilters().minRangedWeaponSpeed,
						setValue: (sim: Sim, newValue: number) => {
							const filters = sim.getFilters();
							filters.minRangedWeaponSpeed = newValue;
							sim.setFilters(filters);
						},
					}}
				/>
				<NumberPicker<Sim>
					modObject={player.sim}
					config={{
						id: 'filters-max-ranged-weapon-speed',
						label: i18n.t('gear_tab.gear_picker.max_ranged_speed'),
						float: true,
						positive: true,
						storeSubscribe,
						getValue: (sim: Sim) => sim.getFilters().maxRangedWeaponSpeed,
						setValue: (sim: Sim, newValue: number) => {
							const filters = sim.getFilters();
							filters.maxRangedWeaponSpeed = newValue;
							sim.setFilters(filters);
						},
					}}
				/>
			</MenuSection>
		</>
	);
};

export const FiltersMenu = ({ slot, open, onOpenChange }: FiltersMenuProps) => {
	const host = useSimHost();
	const player = host.player;
	const sim = player.sim;

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			className="filters-menu"
			container={host.rootElem}
			size="md"
			elevated
			title={i18n.t('gear_tab.gear_picker.filters.title')}>
			<MenuSection name={i18n.t('gear_tab.gear_picker.filters.general')}>
				<div className="ilvl-filters">
					<NumberPicker<Sim>
						modObject={sim}
						config={{
							id: 'filters-min-ilvl',
							label: i18n.t('gear_tab.gear_picker.filters.min_ilvl'),
							showZeroes: false,
							storeSubscribe,
							getValue: (sim: Sim) => sim.getFilters().minIlvl,
							setValue: (sim: Sim, newValue: number) => {
								const newFilters = sim.getFilters();
								newFilters.minIlvl = newValue;
								sim.setFilters(newFilters);
							},
						}}
					/>
					<span className="ilvl-filters-separator">-</span>
					<NumberPicker<Sim>
						modObject={sim}
						config={{
							id: 'filters-max-ilvl',
							label: i18n.t('gear_tab.gear_picker.filters.max_ilvl'),
							showZeroes: false,
							storeSubscribe,
							getValue: (sim: Sim) => sim.getFilters().maxIlvl,
							setValue: (sim: Sim, newValue: number) => {
								const newFilters = sim.getFilters();
								newFilters.maxIlvl = newValue;
								sim.setFilters(newFilters);
							},
						}}
					/>
				</div>
				<EnumPicker<Sim>
					modObject={sim}
					config={{
						id: 'filters-faction-restriction',
						label: i18n.t('gear_tab.gear_picker.filters.faction_restrictions'),
						values: [UIItem_FactionRestriction.UNSPECIFIED, UIItem_FactionRestriction.ALLIANCE_ONLY, UIItem_FactionRestriction.HORDE_ONLY].map(
							restriction => ({ name: factionRestrictionsToLabels[restriction], value: restriction }),
						),
						storeSubscribe,
						getValue: (sim: Sim) => sim.getFilters().factionRestriction,
						setValue: (sim: Sim, newValue: UIItem_FactionRestriction) => {
							const newFilters = sim.getFilters();
							newFilters.factionRestriction = newValue;
							sim.setFilters(newFilters);
						},
					}}
				/>
			</MenuSection>
			<SourceSection sim={sim} />
			<MenuSection name={i18n.t('gear_tab.gear_picker.filters.raids')} className="filters-menu-section-bool-list">
				{Sim.ALL_RAIDS.map(raid => (
					<BooleanPicker<Sim>
						key={raid}
						modObject={sim}
						config={{
							id: `filters-raid-${raid}`,
							label: translateRaidFilter(raid),
							inline: true,
							storeSubscribe,
							getValue: (sim: Sim) => sim.getFilters().raids.includes(raid),
							setValue: (sim: Sim, newValue: boolean) => {
								const filters = sim.getFilters();
								if (newValue) {
									filters.raids.push(raid);
								} else {
									filters.raids = filters.raids.filter(v => v != raid);
								}
								sim.setFilters(filters);
							},
						}}
					/>
				))}
			</MenuSection>
			{Player.ARMOR_SLOTS.includes(slot) ? (
				<ArmorTypeSection player={player} />
			) : Player.WEAPON_SLOTS.includes(slot) ? (
				<>
					<WeaponSections player={player} />
					<RangedWeaponSections player={player} />
				</>
			) : null}
		</Dialog>
	);
};
