import { Tabs } from '@base-ui/react/tabs';
import { AplNavbar } from '@features/apl/components/AplNavbar';
import { GroupList } from '@features/apl/components/GroupList';
import { PrePullList } from '@features/apl/components/PrePullList';
import { PriorityList } from '@features/apl/components/PriorityList';
import { RotationTypePicker } from '@features/apl/components/RotationTypePicker';
import { SavedRotation } from '@features/apl/components/SavedRotation';
import { SimpleRotationInputs } from '@features/apl/components/SimpleRotationInputs';
import { VariablesList } from '@features/apl/components/VariablesList';
import type { AplPaneId } from '@features/apl/model/apl_panes';
import { APL_PANES } from '@features/apl/model/apl_panes';
import { CooldownsPicker, useAvailableCooldowns } from '@features/settings';
import i18n from '@i18n/config';
import { PresetConfigurationCategory } from '@sim/constants/preset_categories';
import { useSimHost, useSpecConfig } from '@sim/context/SimHostContext';
import { ContentBlock } from '@ui-kit/ContentBlock';
import { tabPaneClass } from '@ui-kit/tab_pane_class';
import clsx from 'clsx';
import type { ComponentType } from 'react';
import { useState } from 'react';

import { PresetConfigurationPicker } from '../PresetConfigurationPicker';

const ROTATION_PRESETS = [PresetConfigurationCategory.Rotation];

/** The pre-pull list and the priority list share the first sub-tab. */
const PriorityPane = () => (
	<>
		<PrePullList />
		<PriorityList />
	</>
);

const PANE_BODIES: Record<AplPaneId, ComponentType> = {
	'apl-priority-list': PriorityPane,
	'apl-action-groups': GroupList,
	'apl-variables': VariablesList,
};

/** Preset picker and saved rotations, repeated in all three sub-tabs. */
const RotationSidebar = () => (
	<>
		<PresetConfigurationPicker categories={ROTATION_PRESETS} />
		<SavedRotation />
	</>
);

export const RotationTabBody = () => {
	const host = useSimHost();
	const player = host.player;
	const config = useSpecConfig();
	const hasSimple = player.hasSimpleRotationGenerator() && !!config.rotationInputs;
	const hasCooldowns = useAvailableCooldowns().length > 0;

	const [activeId, setActiveId] = useState<AplPaneId>(APL_PANES[0].id);

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
								{hasCooldowns && (
									<ContentBlock
										className="cooldown-settings"
										config={{
											header: { title: i18n.t('rotation_tab.cooldowns.title'), tooltip: i18n.t('rotation_tab.cooldowns.tooltip') },
										}}>
										<CooldownsPicker />
									</ContentBlock>
								)}
							</div>
						</div>
						<div className="rotation-tab-col tab-panel-right">
							<RotationSidebar />
						</div>
					</>
				)}
			</div>

			<Tabs.Root className="rotation-tab rotation-tab-apl" value={activeId} onValueChange={next => setActiveId(next as AplPaneId)}>
				<AplNavbar />
				<div className="rotation-tab-col tab-panel-left tab-content">
					{APL_PANES.map(pane => {
						const Body = PANE_BODIES[pane.id];
						return (
							<Tabs.Panel key={pane.id} value={pane.id} id={pane.id} keepMounted className={tabPaneClass}>
								<Body />
							</Tabs.Panel>
						);
					})}
				</div>
				<div className="rotation-tab-col tab-panel-right">
					<RotationSidebar />
				</div>
			</Tabs.Root>
		</>
	);
};
