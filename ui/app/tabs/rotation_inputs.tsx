/** @jsxImportSource @jsx-vanilla */
import { Player } from '@sim/player/player';
import type { IndividualSimHost } from '@sim/sim_host';
import { subscribePlayerField } from '@sim/state/subscriptions';
import { APLRotation_Type as APLRotationType } from '@generated/proto/apl';
import i18n from '@i18n/config';
import * as IconInputs from '@ui-kit/icon_inputs';
import { StickyToolbar } from '@ui-kit/sticky_toolbar';
import clsx from 'clsx';
import { Input } from '@ui-kit/input';
import { BooleanPicker } from '@ui-kit/pickers/boolean_picker';
import { TextDropdownPicker } from '@ui-kit/pickers/dropdown_picker';
import { EnumPicker } from '@ui-kit/pickers/enum_picker';
import { NumberPicker } from '@ui-kit/pickers/number_picker';

import type { InputSection } from '../individual_sim_ui';

/** `parent` IS the `.rotation-type-container`; React renders that element so no wrapper appears. */
export function makeRotationTypePicker(parent: HTMLElement, simUI: IndividualSimHost<any>) {
	return new TextDropdownPicker(parent, simUI.player, {
		id: 'rotation-tab-rotation-type',
		defaultLabel: '',
		values: simUI.player.hasSimpleRotationGenerator()
			? [
					{ value: APLRotationType.TypeAuto, label: i18n.t('rotation_tab.common.rotation_type.auto') },
					{ value: APLRotationType.TypeSimple, label: i18n.t('rotation_tab.common.rotation_type.simple') },
					{ value: APLRotationType.TypeAPL, label: i18n.t('rotation_tab.common.rotation_type.apl') },
				]
			: [
					{ value: APLRotationType.TypeAuto, label: i18n.t('rotation_tab.common.rotation_type.auto') },
					{ value: APLRotationType.TypeAPL, label: i18n.t('rotation_tab.common.rotation_type.apl') },
				],
		equals: (a, b) => a === b,
		storeSubscribe: (player: Player<any>) => subscribePlayerField(player, 'rotation'),
		getValue: (player: Player<any>) => player.getRotationType(),
		setValue: (player: Player<any>, newValue: number) => {
			player.modifyAplRotation(rotation => {
				rotation.type = newValue;
			});
		},
	});
}

export function configureInputSection(sectionElem: HTMLElement, player: Player<any>, sectionConfig: InputSection) {
	sectionConfig.inputs.forEach(inputConfig => {
		inputConfig.extraCssClasses = [...(inputConfig.extraCssClasses || []), 'input-inline'];
		if (inputConfig.type == 'number') {
			new NumberPicker(sectionElem, player, { ...inputConfig, inline: true });
		} else if (inputConfig.type == 'boolean') {
			new BooleanPicker(sectionElem, player, { ...inputConfig, inline: true, reverse: true });
		} else if (inputConfig.type == 'enum') {
			new EnumPicker(sectionElem, player, { ...inputConfig, inline: true });
		}
	});
}

export function configureIconSection(sectionElem: HTMLElement, iconPickers: Array<any>, adjustColumns?: boolean) {
	if (!iconPickers.length) {
		sectionElem.classList.add('hide');
	} else if (adjustColumns) {
		if (iconPickers.length <= 4) {
			sectionElem.style.gridTemplateColumns = `repeat(${iconPickers.length}, 1fr)`;
		} else if (iconPickers.length > 4 && iconPickers.length < 8) {
			sectionElem.style.gridTemplateColumns = `repeat(${Math.ceil(iconPickers.length / 2)}, 1fr)`;
		}
	}
}

/** The rotation icon group, built into `parent` exactly as the vanilla tab appended it. */
export function makeRotationIconGroup(parent: HTMLElement, simUI: IndividualSimHost<any>) {
	const group = Input.newGroupContainer();
	group.classList.add('rotation-icon-group', 'icon-group');
	parent.appendChild(group);

	if (simUI.individualConfig.rotationIconInputs?.length) {
		configureIconSection(
			group,
			simUI.individualConfig.rotationIconInputs.map(iconInput => IconInputs.buildIconInput(group, simUI.player, iconInput)),
			true,
		);
	}
	return group;
}

const APL_PANES = [
	{ id: 'apl-priority-list', label: 'rotation_tab.apl.tabs.priorityList' },
	{ id: 'apl-action-groups', label: 'rotation_tab.apl.tabs.actionGroups' },
	{ id: 'apl-variables', label: 'rotation_tab.apl.tabs.variables' },
];

/**
 * The whole navbar stays imperative. React could render the tab strip, but `StickyToolbar` and the
 * rotation-type picker append themselves, so a React-rendered `<ul>` would land ahead of them
 * instead of after — and the order is the one thing the layout depends on.
 */
export function makeAplNavbar(parent: HTMLElement, simUI: IndividualSimHost<any>) {
	const toolbar = new StickyToolbar(parent, simUI);
	const typeContainer = (<div className="rotation-type-container" />) as HTMLElement;
	parent.appendChild(typeContainer);
	const picker = makeRotationTypePicker(typeContainer, simUI);

	parent.appendChild(
		<ul className="nav nav-tabs" attributes={{ role: 'tablist' }}>
			{APL_PANES.map((pane, index) => (
				<li className="nav-item" attributes={{ role: 'presentation' }}>
					<button
						type="button"
						className={clsx('nav-link', index === 0 && 'active')}
						attributes={{
							role: 'tab',
							// @ts-expect-error aria-controls is not in the vanilla attribute map
							'aria-controls': pane.id,
							'aria-selected': index === 0,
						}}
						dataset={{ bsToggle: 'tab', bsTarget: `#${pane.id}` }}>
						{i18n.t(pane.label)}
					</button>
				</li>
			))}
		</ul>,
	);

	return [toolbar, picker];
}
