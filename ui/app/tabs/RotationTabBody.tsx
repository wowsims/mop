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
import { APLRotation_Type as APLRotationType } from '@generated/proto/apl';
import i18n from '@i18n/config';
import { PresetConfigurationCategory } from '@sim/constants/preset_categories';
import { useSimHost, useSpecConfig } from '@sim/context/SimHostContext';
import { ContentBlock } from '@ui-kit/ContentBlock';
import { TabPanel, TabPanels } from '@ui-kit/TabNav';
import { TabPanelColumns } from '@ui-kit/TabPanelColumns';
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

export interface RotationTabBodyProps {
	rotationType: APLRotationType;
}

export const RotationTabBody = ({ rotationType }: RotationTabBodyProps) => {
	const host = useSimHost();
	const player = host.player;
	const config = useSpecConfig();
	const hasSimple = player.hasSimpleRotationGenerator() && !!config.rotationInputs;
	const hasCooldowns = useAvailableCooldowns().length > 0;

	const [activeId, setActiveId] = useState<AplPaneId>(APL_PANES[0].id);

	return (
		<>
			{rotationType === APLRotationType.TypeAuto && (
				<TabPanelColumns.Root fullWidth>
					<TabPanelColumns.Left variant="stacked">
						<div>
							<RotationTypePicker />
						</div>
						<p>{i18n.t('rotation_tab.auto.description')}</p>
					</TabPanelColumns.Left>
					<TabPanelColumns.Right>
						<RotationSidebar />
					</TabPanelColumns.Right>
				</TabPanelColumns.Root>
			)}

			{rotationType === APLRotationType.TypeSimple && hasSimple && (
				<TabPanelColumns.Root fullWidth>
					<TabPanelColumns.Left variant="stacked">
						<div>
							<RotationTypePicker />
						</div>
						<div className="grid grid-cols-2 gap-page max-xl:grid-cols-1">
							<ContentBlock config={{ header: { title: i18n.t('rotation_tab.simple.title') } }}>
								<SimpleRotationInputs />
							</ContentBlock>
							{hasCooldowns && (
								<ContentBlock
									testId="cooldown-settings"
									config={{
										header: { title: i18n.t('rotation_tab.cooldowns.title'), tooltip: i18n.t('rotation_tab.cooldowns.tooltip') },
									}}>
									<CooldownsPicker />
								</ContentBlock>
							)}
						</div>
					</TabPanelColumns.Left>
					<TabPanelColumns.Right>
						<RotationSidebar />
					</TabPanelColumns.Right>
				</TabPanelColumns.Root>
			)}

			{rotationType === APLRotationType.TypeAPL && (
				<TabPanelColumns.Root
					as={Tabs.Root}
					data-testid="rotation-tab-apl"
					gap="apl"
					fullWidth
					value={activeId}
					onValueChange={(next: string) => setActiveId(next as AplPaneId)}>
					<AplNavbar />
					<TabPanelColumns.Left>
						<TabPanels>
							{APL_PANES.map(pane => {
								const Body = PANE_BODIES[pane.id];
								return (
									<TabPanel key={pane.id} value={pane.id} className="gap-section pt-0 not-data-hidden:flex not-data-hidden:flex-col">
										<Body />
									</TabPanel>
								);
							})}
						</TabPanels>
					</TabPanelColumns.Left>
					<TabPanelColumns.Right>
						<RotationSidebar />
					</TabPanelColumns.Right>
				</TabPanelColumns.Root>
			)}
		</>
	);
};
