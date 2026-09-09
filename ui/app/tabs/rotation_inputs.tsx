/** @jsxImportSource @jsx-vanilla */
import { APLRotation_Type as APLRotationType } from '@generated/proto/apl';
import i18n from '@i18n/config';
import { Player } from '@sim/player/player';
import type { IndividualSimHost } from '@sim/sim_host';
import { subscribePlayerField } from '@sim/state/subscriptions';
import { TextDropdownPicker } from '@ui-kit/pickers/dropdown_picker';
import { StickyToolbar } from '@ui-kit/sticky_toolbar';
import clsx from 'clsx';

/**
 * The APL navbar's own copy of the rotation-type picker. The two in the Auto and Simple panes are
 * `features/apl/components/RotationTypePicker` now; this one stays vanilla for as long as the
 * navbar around it does.
 */
function makeRotationTypePicker(parent: HTMLElement, simUI: IndividualSimHost<any>) {
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

/** The three APL sub-tabs. The strip is built here and the panes in `RotationTabBody`, so the ids and labels live in one place rather than in both. */
export const APL_PANES = [
	{ id: 'apl-priority-list', label: 'rotation_tab.apl.tabs.priorityList' },
	{ id: 'apl-action-groups', label: 'rotation_tab.apl.tabs.actionGroups' },
	{ id: 'apl-variables', label: 'rotation_tab.apl.tabs.variables' },
] as const;

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
