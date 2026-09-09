import { CharacterStats } from '@features/character-stats';
import { ReforgePanel } from '@features/reforge/components/ReforgePanel';
import { DetailedResults } from '@features/results/components/DetailedResults';
import { SimResultsPanel } from '@features/results/components/SimResultsPanel';
import { EpWeightsDialog } from '@features/stat-weights/components/EpWeightsDialog';
import type { Spec } from '@generated/proto/common';
import i18n from '@i18n/config';
import { SimHostProvider } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import type { SpecDefinition } from '@sim/spec_config';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ImportExportKind } from './header/import_export_registry';
import { ImportExportMenu } from './header/ImportExportMenu';
import { IndividualSimUI } from './individual_sim_ui';
import { knownIssuesFor } from './known_issues';
import type { ShellDom } from './shell_dom';
import { SimShell } from './SimShell';
import { SimTabs } from './SimTabs';
import { BulkTabBody } from './tabs/BulkTabBody';
import { GearTabBody } from './tabs/GearTabBody';
import { RotationTabBody } from './tabs/RotationTabBody';
import { SettingsTabBody } from './tabs/SettingsTabBody';
import { TalentsTabBody } from './tabs/TalentsTabBody';

export interface SimAppProps<SpecType extends Spec> {
	player: Player<SpecType>;
	def: SpecDefinition<SpecType>;
}

export const SimApp = <SpecType extends Spec>({ player, def }: SimAppProps<SpecType>) => {
	const domRef = useRef<ShellDom | null>(null);
	const simUIRef = useRef<IndividualSimUI<SpecType> | null>(null);
	const constructed = useRef(false);
	const [simUI, setSimUI] = useState<IndividualSimUI<SpecType> | null>(null);

	const shell = useMemo(
		() => (
			<SimShell
				domRef={domRef}
				sim={player.sim}
				className={def.cssClass}
				spec={player.getPlayerSpec()}
				knownIssues={knownIssuesFor(player.getPlayerSpec().launch, def.knownIssues)}
				onOpenSettings={() => simUIRef.current?.simHeader.openSettings()}
			/>
		),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	);

	useLayoutEffect(() => {
		if (constructed.current || !domRef.current) return;
		constructed.current = true;
		simUIRef.current = new IndividualSimUI(domRef.current, player, def);
		setSimUI(simUIRef.current);
	}, [player, def]);

	return (
		<>
			<div className="sim-app">{shell}</div>
			{simUI && (
				<SimHostProvider host={simUI}>
					<SimTabs registry={simUI.tabs} strip={simUI.simHeader.simTabsContainer} panes={simUI.simTabContentsContainer} />
					{createPortal(
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
						</>,
						simUI.simHeader.importExportContainer,
					)}
					{createPortal(
						<SimResultsPanel panel={simUI.resultsPanel} warnings={simUI.warnings} results={simUI.raidSimResultsManager} />,
						simUI.sidebarResultsContainer,
					)}
					{createPortal(<CharacterStats />, simUI.sidebarStatsContainer)}
					{simUI.raidSimResultsManager &&
						createPortal(
							<DetailedResults resultsManager={simUI.raidSimResultsManager} makeLogExporter={simUI.makeLogExporter} />,
							simUI.detailedResultsContainer,
						)}
					{createPortal(<GearTabBody />, simUI.gearTab.contentContainer)}
					{createPortal(<TalentsTabBody />, simUI.talentsTab.contentContainer)}
					{createPortal(<SettingsTabBody />, simUI.settingsTab.contentContainer)}
					{createPortal(<RotationTabBody />, simUI.rotationTab.contentContainer)}
					{simUI.bt && createPortal(<BulkTabBody />, simUI.bt.contentContainer)}
					{simUI.reforger &&
						simUI.reforgeActionsContainer &&
						createPortal(
							<ReforgePanel model={simUI.reforger} options={simUI.reforgeOptions ?? undefined} container={simUI.reforgeActionsContainer} />,
							simUI.reforgeActionsContainer,
						)}
					<EpWeightsDialog opener={simUI.epWeightsModal} settings={simUI.statWeightActionSettings} />
				</SimHostProvider>
			)}
		</>
	);
};
