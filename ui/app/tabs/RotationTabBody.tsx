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
import { CooldownsPicker } from '@features/settings';
import i18n from '@i18n/config';
import { PresetConfigurationCategory } from '@sim/constants/preset_categories';
import { useSimHost } from '@sim/context/SimHostContext';
import { ContentBlock } from '@ui-kit/ContentBlock';
import { useTabFade } from '@ui-kit/hooks/useTabFade';
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
	const config = host.individualConfig;
	const hasSimple = player.hasSimpleRotationGenerator() && !!config.rotationInputs;

	const [activeId, setActiveId] = useState<AplPaneId>(APL_PANES[0].id);
	const shownId = useTabFade(activeId);

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
									config={{ header: { title: i18n.t('rotation_tab.cooldowns.title'), tooltip: i18n.t('rotation_tab.cooldowns.tooltip') } }}>
									<CooldownsPicker />
								</ContentBlock>
							</div>
						</div>
						<div className="rotation-tab-col tab-panel-right">
							<RotationSidebar />
						</div>
					</>
				)}
			</div>

			<div className="rotation-tab rotation-tab-apl">
				<AplNavbar activeId={activeId} onSelect={setActiveId} />
				<div className="rotation-tab-col tab-panel-left tab-content">
					{APL_PANES.map(pane => {
						const Body = PANE_BODIES[pane.id];
						return (
							<div
								key={pane.id}
								id={pane.id}
								role="tabpanel"
								className={clsx('tab-pane fade', pane.id === activeId && 'active', pane.id === shownId && 'show')}>
								<Body />
							</div>
						);
					})}
				</div>
				<div className="rotation-tab-col tab-panel-right">
					<RotationSidebar />
				</div>
			</div>
		</>
	);
};
