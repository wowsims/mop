import { CharacterStats } from '@features/character-stats';
import { SimResultsPanel } from '@features/results/components/SimResultsPanel';
import { EpWeightsDialog } from '@features/stat-weights/components/EpWeightsDialog';
import type { Spec } from '@generated/proto/common';
import i18n from '@i18n/config';
import { SimHostProvider } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import type { SpecDefinition } from '@sim/spec_config';
import { useLayoutEffect, useRef, useState } from 'react';

import { trackPageView } from '../tracking/analytics';
import { ImportExportKind } from './header/import_export_registry';
import { ImportExportMenu } from './header/ImportExportMenu';
import { SimHostObject } from './individual_sim_ui';
import { knownIssuesFor } from './known_issues';
import { NoticeNativeSim } from './NoticeNativeSim';
import { SettingsDialog } from './SettingsDialog';
import type { ShellDom } from './shell_dom';
import { SidebarActions } from './SidebarActions';
import { SimShell } from './SimShell';
import { SimTabs } from './SimTabs';

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
						tabs: simUI && <SimTabs registry={simUI.tabs} panes={simUI.simTabContentsContainer} />,
						importExport: simUI && (
							<>
								<ImportExportMenu
									kind={ImportExportKind.Import}
									registry={simUI.simHeader.importExport}
									icon="download"
									title={i18n.t('import.title')}
								/>
								<ImportExportMenu
									kind={ImportExportKind.Export}
									registry={simUI.simHeader.importExport}
									icon="right-from-bracket"
									title={i18n.t('export.title')}
								/>
							</>
						),
						sidebarActions: simUI && (
							<>
								<SidebarActions registry={simUI.sidebar} disabled={simUI.disabled} />
								<NoticeNativeSim container={simUI.simActionsContainer} />
							</>
						),
						sidebarResults: simUI && <SimResultsPanel panel={simUI.resultsPanel} warnings={simUI.warnings} results={simUI.raidSimResultsManager} />,
						sidebarStats: simUI && <CharacterStats />,
					}}
				/>
			</div>
			{simUI && (
				<>
					<EpWeightsDialog opener={simUI.epWeightsModal} settings={simUI.statWeightActionSettings} />
					<SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} host={simUI} />
				</>
			)}
		</SimHostProvider>
	);
};
