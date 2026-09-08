import { RotationTypePicker } from '@features/apl/components/RotationTypePicker';
import { SavedRotation } from '@features/apl/components/SavedRotation';
import { SimpleRotationInputs } from '@features/apl/components/SimpleRotationInputs';
import { APLGroupListPicker } from '@features/apl/view/apl_group_list_picker';
import { APLVariablesListPicker } from '@features/apl/view/apl_variables_list_picker';
import { APLPrePullListPicker } from '@features/apl/view/pre_pull_list_picker';
import { APLPriorityListPicker } from '@features/apl/view/priority_list_picker';
import { CooldownsPicker } from '@features/settings/view/cooldowns_picker';
import i18n from '@i18n/config';
import { PresetConfigurationCategory } from '@sim/constants/preset_categories';
import { useSimHost } from '@sim/context/SimHostContext';
import { ContentBlock } from '@ui-kit/ContentBlock';
import { useLegacyMount } from '@ui-kit/hooks/useLegacyMount';
import clsx from 'clsx';

import { PresetConfigurationPicker } from '../PresetConfigurationPicker';
import { makeAplNavbar } from './rotation_inputs';

const ROTATION_PRESETS = [PresetConfigurationCategory.Rotation];

const APL_PANES = [
	{ id: 'apl-priority-list', label: 'rotation_tab.apl.tabs.priorityList' },
	{ id: 'apl-action-groups', label: 'rotation_tab.apl.tabs.actionGroups' },
	{ id: 'apl-variables', label: 'rotation_tab.apl.tabs.variables' },
] as const;

/** Preset picker and saved rotations, repeated in all three sub-tabs exactly as vanilla did. */
const RotationSidebar = () => (
	<>
		<PresetConfigurationPicker categories={ROTATION_PRESETS} />
		<SavedRotation />
	</>
);

export const RotationTabBody = () => {
	const host = useSimHost();
	const player = host.player;
	const config = host.individualConfig;
	const hasSimple = player.hasSimpleRotationGenerator() && !!config.rotationInputs;

	const mountAplNavbar = useLegacyMount(parent => makeAplNavbar(parent, host), [host]);
	const mountCooldowns = useLegacyMount(parent => new CooldownsPicker(parent, player), [player]);

	const mountPriorityList = useLegacyMount(parent => [new APLPrePullListPicker(parent, host), new APLPriorityListPicker(parent, host)], [host]);
	const mountActionGroups = useLegacyMount(parent => new APLGroupListPicker(parent, host), [host]);
	const mountVariables = useLegacyMount(parent => new APLVariablesListPicker(parent, host), [host]);

	const aplMounts = [mountPriorityList, mountActionGroups, mountVariables];

	return (
		<>
			<div className="rotation-tab rotation-tab-auto">
				<div className="rotation-tab-col tab-panel-left">
					<div className="rotation-type-container">
						<RotationTypePicker />
					</div>
					<p>{i18n.t('rotation_tab.auto.description')}</p>
				</div>
				<div className="rotation-tab-col tab-panel-right">
					<RotationSidebar />
				</div>
			</div>

			<div className="rotation-tab rotation-tab-simple">
				{hasSimple && (
					<>
						<div className="rotation-tab-col tab-panel-left tab-content">
							<div className="rotation-type-container">
								<RotationTypePicker />
							</div>
							<div className="simple-rotation-container">
								<ContentBlock className="rotation-settings" config={{ header: { title: i18n.t('rotation_tab.simple.title') } }}>
									<SimpleRotationInputs />
								</ContentBlock>
								<ContentBlock
									className="cooldown-settings"
									config={{ header: { title: i18n.t('rotation_tab.cooldowns.title'), tooltip: i18n.t('rotation_tab.cooldowns.tooltip') } }}
									bodyRef={mountCooldowns}
								/>
							</div>
						</div>
						<div className="rotation-tab-col tab-panel-right">
							<RotationSidebar />
						</div>
					</>
				)}
			</div>

			<div className="rotation-tab rotation-tab-apl">
				<div className="apl-rotation-navbar" ref={mountAplNavbar} />
				<div className="rotation-tab-col tab-panel-left tab-content">
					{APL_PANES.map((pane, index) => (
						<div key={pane.id} id={pane.id} className={clsx('tab-pane fade', index === 0 && 'active show')} ref={aplMounts[index]} />
					))}
				</div>
				<div className="rotation-tab-col tab-panel-right">
					<RotationSidebar />
				</div>
			</div>
		</>
	);
};
