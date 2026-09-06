import type { Player } from '@domain/player';
import { CharacterStats } from '@features/character-stats';
import { SimHostProvider } from '@features/SimHostContext';
import type { SpecDefinition } from '@features/spec_config';
import type { Spec } from '@generated/proto/common';
import i18n from '@i18n/config';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ImportExportMenu } from './header/ImportExportMenu';
import { IndividualSimUI } from './individual_sim_ui';
import { knownIssuesFor } from './known_issues';
import type { ShellDom } from './shell_dom';
import { SimShell } from './SimShell';
import { SimTabs } from './SimTabs';
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
				cssClass={def.cssClass}
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
							<ImportExportMenu kind="import" registry={simUI.simHeader.importExport} icon="download" title={i18n.t('import.title')} />
							<ImportExportMenu kind="export" registry={simUI.simHeader.importExport} icon="right-from-bracket" title={i18n.t('export.title')} />
						</>,
						simUI.simHeader.importExportContainer,
					)}
					{createPortal(<CharacterStats />, simUI.sidebarStatsContainer)}
					{createPortal(<TalentsTabBody />, simUI.talentsTab.contentContainer)}
					{createPortal(<SettingsTabBody />, simUI.settingsTab.contentContainer)}
				</SimHostProvider>
			)}
		</>
	);
};
