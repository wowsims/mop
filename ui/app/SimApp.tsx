import type { Player } from '@domain/player';
import { CharacterStats } from '@features/character-stats';
import { SimHostProvider } from '@features/SimHostContext';
import type { SpecDefinition } from '@features/spec_config';
import type { Spec } from '@generated/proto/common';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { IndividualSimUI } from './individual_sim_ui';
import type { ShellDom } from './shell_dom';
import { SimShell } from './SimShell';
import { SimTabs } from './SimTabs';
import { TalentsTabBody } from './tabs/TalentsTabBody';

export interface SimAppProps<SpecType extends Spec> {
	player: Player<SpecType>;
	def: SpecDefinition<SpecType>;
}

export const SimApp = <SpecType extends Spec>({ player, def }: SimAppProps<SpecType>) => {
	const domRef = useRef<ShellDom | null>(null);
	// Constructing the shell is not undoable — loadIndividualSettings subscribes autosave and returns
	// no unsubscribe — so it happens once and StrictMode's second pass is a no-op.
	const constructed = useRef(false);
	const [simUI, setSimUI] = useState<IndividualSimUI<SpecType> | null>(null);

	// Rendered once and held: everything inside is filled imperatively, so a re-render that recreated
	// any of those nodes would take the vanilla content with it. See SimShell's own note.
	const shell = useMemo(
		() => <SimShell domRef={domRef} sim={player.sim} cssClass={def.cssClass} spec={player.getPlayerSpec()} />,
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	);

	useLayoutEffect(() => {
		if (constructed.current || !domRef.current) return;
		constructed.current = true;
		setSimUI(new IndividualSimUI(domRef.current, player, def));
	}, [player, def]);

	// The skeleton renders immediately; everything that needs the constructed shell hangs off `simUI`,
	// which only exists after the effect above has run.
	return (
		<>
			<div className="sim-app">{shell}</div>
			{simUI && (
				<SimHostProvider host={simUI}>
					<SimTabs registry={simUI.tabs} strip={simUI.simHeader.simTabsContainer} panes={simUI.simTabContentsContainer} />
					{/* Context reaches through a portal: it follows the React tree, not the DOM one. */}
					{createPortal(<CharacterStats />, simUI.sidebarStatsContainer)}
					{createPortal(<TalentsTabBody />, simUI.talentsTab.contentContainer)}
				</SimHostProvider>
			)}
		</>
	);
};
