import { EpWeightsDialog } from '@features/stat-weights/components/EpWeightsDialog';
import { OpenEpWeightsContext } from '@features/stat-weights/hooks/useEpWeightsDialog';
import type { Spec } from '@generated/proto/common';
import { SimHostProvider } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import type { SpecDefinition } from '@sim/spec_config';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { trackPageView } from '../tracking/analytics';
import { CrashReportDialog } from './CrashReportDialog';
import { SimHostObject } from './individual_sim_ui';
import { knownIssuesFor } from './known_issues';
import { SettingsDialog } from './SettingsDialog';
import type { ShellDom } from './shell_dom';
import { SimShell } from './SimShell';

export interface SimAppProps<SpecType extends Spec> {
	player: Player<SpecType>;
	def: SpecDefinition<SpecType>;
}

export const SimApp = <SpecType extends Spec>({ player, def }: SimAppProps<SpecType>) => {
	const domRef = useRef<ShellDom | null>(null);
	const constructed = useRef(false);
	const [simUI, setSimUI] = useState<SimHostObject<SpecType> | null>(null);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [epWeightsOpen, setEpWeightsOpen] = useState(false);
	const openEpWeights = useCallback(() => setEpWeightsOpen(true), []);

	useLayoutEffect(() => {
		if (constructed.current || !domRef.current) return;
		constructed.current = true;
		setSimUI(new SimHostObject(domRef.current, player, def));
	}, [player, def]);

	return (
		<SimHostProvider host={simUI}>
			<OpenEpWeightsContext value={openEpWeights}>
				<SimShell
					domRef={domRef}
					host={simUI}
					sim={player.sim}
					className={def.cssClass}
					spec={player.getPlayerSpec()}
					knownIssues={knownIssuesFor(player.getPlayerSpec().launch, def.knownIssues)}
					onOpenSettings={() => {
						trackPageView('Options', '/settings-menu');
						setSettingsOpen(true);
					}}
				/>
				{simUI && (
					<>
						<CrashReportDialog opener={simUI.crashReport} />
						<EpWeightsDialog open={epWeightsOpen} onOpenChange={setEpWeightsOpen} settings={simUI.statWeightActionSettings} />
						<SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} host={simUI} />
					</>
				)}
			</OpenEpWeightsContext>
		</SimHostProvider>
	);
};
