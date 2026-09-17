import { ItemSlot } from '@generated/proto/common';
import { DatabaseFilters, SourceFilterOption, UIItem_FactionRestriction } from '@generated/proto/ui';
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

type FilterListField = { [K in keyof DatabaseFilters]: DatabaseFilters[K] extends Array<number> ? K : never }[keyof DatabaseFilters];
type FilterNumberField = { [K in keyof DatabaseFilters]: DatabaseFilters[K] extends number ? K : never }[keyof DatabaseFilters];

const SPEED_OPTIONS = { float: true, positive: true };

const listFilterConfig = <K extends FilterListField>(field: K, value: DatabaseFilters[K][number], id: string, label: string) => ({
	id,
	label,
	layout: 'inline' as const,
	storeSubscribe,
	getValue: (sim: Sim) => (sim.getFilters() as Record<FilterListField, Array<number>>)[field].includes(value),
	setValue: (sim: Sim, newValue: boolean) => {
		const filters = sim.getFilters();
		const lists = filters as Record<FilterListField, Array<number>>;
		if (newValue) {
			lists[field].push(value);
		} else {
			lists[field] = lists[field].filter(v => v != value);
		}
		sim.setFilters(filters);
	},
});

const numberFilterConfig = (
	field: FilterNumberField,
	id: string,
	label: string,
	options: { float?: boolean; positive?: boolean; showZeroes?: boolean } = {},
) => ({
	id,
	label,
	...options,
	storeSubscribe,
	getValue: (sim: Sim) => (sim.getFilters() as Record<FilterNumberField, number>)[field],
	setValue: (sim: Sim, newValue: number) => {
		const filters = sim.getFilters();
		(filters as Record<FilterNumberField, number>)[field] = newValue;
		sim.setFilters(filters);
	},
});

export interface FiltersMenuProps {
	slot: ItemSlot;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const MenuSection = ({ name, className, children }: { name: string; className?: ClassValue; children: ReactNode }) => (
	<div className={clsx('flex max-sm:block', `${kebabCase(name)}-section`)}>
		<div className="flex-1">
			<h6 data-testid="menu-section-title">{name}</h6>
		</div>
		<div className={clsx('flex-3', className ?? 'flex flex-col gap-3')}>{children}</div>
	</div>
);

const SourceSection = ({ sim }: { sim: Sim }) => (
	<MenuSection name={i18n.t('gear_tab.gear_picker.filters.source')} className="ui-filters-menu-section-bool-list">
		{SOURCES.map(source => {
			const label = translateSourceFilter(source);
			if (!label) return null;
			return <BooleanPicker<Sim> key={source} modObject={sim} config={listFilterConfig('sources', source, `filters-source-${source}`, label)} />;
		})}
	</MenuSection>
);

const ArmorTypeSection = ({ player }: { player: Player<any> }) => {
	const armorTypes = player.getPlayerClass().armorTypes;
	if (armorTypes.length <= 1) return null;

	return (
		<MenuSection name={i18n.t('gear_tab.gear_picker.armor_type')} className="ui-filters-menu-section-bool-list">
			{armorTypes.map(armorType => (
				<BooleanPicker<Sim>
					key={armorType}
					modObject={player.sim}
					config={listFilterConfig('armorTypes', armorType, `filters-armor-type-${armorType}`, translateArmorType(armorType))}
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
			<MenuSection name={i18n.t('gear_tab.gear_picker.weapon_type')} className="ui-filters-menu-section-bool-list">
				{weaponTypes.map(weaponType => (
					<BooleanPicker<Sim>
						key={weaponType}
						modObject={player.sim}
						config={listFilterConfig('weaponTypes', weaponType, `filters-weapon-type-${weaponType}`, translateWeaponType(weaponType))}
					/>
				))}
			</MenuSection>
			<MenuSection name={i18n.t('gear_tab.gear_picker.weapon_speed')} className="ui-filters-menu-section-number-list">
				<NumberPicker<Sim>
					modObject={player.sim}
					config={numberFilterConfig('minMhWeaponSpeed', 'filters-min-weapon-speed', i18n.t('gear_tab.gear_picker.min_mh_speed'), SPEED_OPTIONS)}
				/>
				<NumberPicker<Sim>
					modObject={player.sim}
					config={numberFilterConfig('maxMhWeaponSpeed', 'filters-max-weapon-speed', i18n.t('gear_tab.gear_picker.max_mh_speed'), SPEED_OPTIONS)}
				/>
				{player.getPlayerSpec().canDualWield && (
					<>
						<NumberPicker<Sim>
							modObject={player.sim}
							config={numberFilterConfig(
								'minOhWeaponSpeed',
								'filters-min-oh-weapon-speed',
								i18n.t('gear_tab.gear_picker.min_oh_speed'),
								SPEED_OPTIONS,
							)}
						/>
						<NumberPicker<Sim>
							modObject={player.sim}
							config={numberFilterConfig(
								'maxOhWeaponSpeed',
								'filters-max-oh-weapon-speed',
								i18n.t('gear_tab.gear_picker.max_oh_speed'),
								SPEED_OPTIONS,
							)}
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
			<MenuSection name={i18n.t('gear_tab.gear_picker.ranged_weapon_type')} className="ui-filters-menu-section-bool-list">
				{rangedWeaponTypes.map(rangedWeaponType => (
					<BooleanPicker<Sim>
						key={rangedWeaponType}
						modObject={player.sim}
						config={listFilterConfig(
							'rangedWeaponTypes',
							rangedWeaponType,
							`filter-ranged-weapon-type-${rangedWeaponType}`,
							translateRangedWeaponType(rangedWeaponType),
						)}
					/>
				))}
			</MenuSection>
			<MenuSection name={i18n.t('gear_tab.gear_picker.ranged_weapon_speed')} className="ui-filters-menu-section-number-list">
				<NumberPicker<Sim>
					modObject={player.sim}
					config={numberFilterConfig(
						'minRangedWeaponSpeed',
						'filters-min-ranged-weapon-speed',
						i18n.t('gear_tab.gear_picker.min_ranged_speed'),
						SPEED_OPTIONS,
					)}
				/>
				<NumberPicker<Sim>
					modObject={player.sim}
					config={numberFilterConfig(
						'maxRangedWeaponSpeed',
						'filters-max-ranged-weapon-speed',
						i18n.t('gear_tab.gear_picker.max_ranged_speed'),
						SPEED_OPTIONS,
					)}
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
			testId="filters-menu"
			size="md"
			elevated
			bodyGap="gap-3"
			title={i18n.t('gear_tab.gear_picker.filters.title')}>
			<MenuSection name={i18n.t('gear_tab.gear_picker.filters.general')}>
				<div className="grid grid-cols-split gap-x-(--modal-padding)">
					<NumberPicker<Sim>
						modObject={sim}
						config={numberFilterConfig('minIlvl', 'filters-min-ilvl', i18n.t('gear_tab.gear_picker.filters.min_ilvl'), { showZeroes: false })}
					/>
					<span className="flex justify-center self-end py-1.5">-</span>
					<NumberPicker<Sim>
						modObject={sim}
						config={numberFilterConfig('maxIlvl', 'filters-max-ilvl', i18n.t('gear_tab.gear_picker.filters.max_ilvl'), { showZeroes: false })}
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
			<MenuSection name={i18n.t('gear_tab.gear_picker.filters.raids')} className="ui-filters-menu-section-bool-list">
				{Sim.ALL_RAIDS.map(raid => (
					<BooleanPicker<Sim>
						key={raid}
						modObject={sim}
						config={listFilterConfig('raids', raid, `filters-raid-${raid}`, translateRaidFilter(raid))}
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
