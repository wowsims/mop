import { CharacterStats } from '@features/character-stats';
import { SimResultsPanel } from '@features/results/components/SimResultsPanel';
import { SimulateAction } from '@features/results/components/SimulateAction';
import { EpWeightsDialog } from '@features/stat-weights/components/EpWeightsDialog';
import { StatWeightsAction } from '@features/stat-weights/components/StatWeightsAction';
import type { Spec } from '@generated/proto/common';
import { SimHostProvider } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import type { SpecDefinition } from '@sim/spec_config';
import { SidebarDisabledContext } from '@ui-kit/SidebarActionButton';
import { useLayoutEffect, useRef, useState } from 'react';

import { trackPageView } from '../tracking/analytics';
import { CrashReportDialog } from './CrashReportDialog';
import { SimHostObject } from './individual_sim_ui';
import { knownIssuesFor } from './known_issues';
import { NoticeNativeSim } from './NoticeNativeSim';
import { SettingsDialog } from './SettingsDialog';
import type { ShellDom } from './shell_dom';
import { SidebarActions } from './SidebarActions';
import { SimImportExport } from './SimImportExport';
import { SimShell } from './SimShell';
import { SimTabsSection } from './SimTabsSection';

export interface SimAppProps<SpecType extends Spec> {
	player: Player<SpecType>;
	def: SpecDefinition<SpecType>;
}

export const SimApp = <SpecType extends Spec>({ player, def }: SimAppProps<SpecType>) => {
	const domRef = useRef<ShellDom | null>(null);
	const constructed = useRef(false);
	const [simUI, setSimUI] = useState<SimHostObject<SpecType> | null>(null);
	const [settingsOpen, setSettingsOpen] = useState(false);

	useLayoutEffect(() => {
		if (constructed.current || !domRef.current) return;
		constructed.current = true;
		setSimUI(new SimHostObject(domRef.current, player, def));
	}, [player, def]);

	return (
		<SimHostProvider host={simUI}>
			<div className="sim-app">
				<SimShell
					domRef={domRef}
					sim={player.sim}
					className={def.cssClass}
					spec={player.getPlayerSpec()}
					knownIssues={knownIssuesFor(player.getPlayerSpec().launch, def.knownIssues)}
					onOpenSettings={() => {
						trackPageView('Options', '/settings-menu');
						setSettingsOpen(true);
					}}
					slots={{
						tabs: simUI && <SimTabsSection host={simUI} />,
						importExport: simUI && <SimImportExport />,
						// The sim's own two actions bracket the spec's, which is the order they were appended in.
						sidebarActions: simUI && (
							<SidebarDisabledContext value={simUI.disabled}>
								<SimulateAction />
								<SidebarActions registry={simUI.sidebar} />
								<StatWeightsAction />
								<NoticeNativeSim container={simUI.simActionsContainer} />
							</SidebarDisabledContext>
						),
						sidebarResults: simUI && <SimResultsPanel panel={simUI.resultsPanel} warnings={simUI.warnings} results={simUI.raidSimResultsManager} />,
						sidebarStats: simUI && <CharacterStats />,
					}}
				/>
			</div>
			{simUI && (
				<>
					<CrashReportDialog opener={simUI.crashReport} />
					<EpWeightsDialog opener={simUI.epWeightsModal} settings={simUI.statWeightActionSettings} />
					<SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} host={simUI} />
				</>
			)}
		</SimHostProvider>
	);
};
