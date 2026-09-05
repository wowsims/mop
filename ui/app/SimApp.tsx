import type { Player } from '@domain/player';
import { CharacterStats } from '@features/character-stats';
import { SimHostProvider } from '@features/SimHostContext';
import type { SpecDefinition } from '@features/spec_config';
import type { Spec } from '@generated/proto/common';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { IndividualSimUI } from './individual_sim_ui';
import { buildShellDom } from './shell_dom';
import { SimTabs } from './SimTabs';
import { TalentsTabBody } from './tabs/TalentsTabBody';

export interface SimAppProps<SpecType extends Spec> {
	player: Player<SpecType>;
	def: SpecDefinition<SpecType>;
}

export const SimApp = <SpecType extends Spec>({ player, def }: SimAppProps<SpecType>) => {
	const mountRef = useRef<HTMLDivElement>(null);
	// Constructing the shell is not undoable — loadIndividualSettings subscribes autosave and returns
	// no unsubscribe — so it happens once and StrictMode's second pass is a no-op.
	const constructed = useRef(false);
	const [simUI, setSimUI] = useState<IndividualSimUI<SpecType> | null>(null);

	useLayoutEffect(() => {
		if (constructed.current || !mountRef.current) return;
		constructed.current = true;
		setSimUI(new IndividualSimUI(buildShellDom(mountRef.current, {}), player, def));
	}, [player, def]);

	// Every React-owned piece of the shell hangs off `simUI`, not off the first render: the containers
	// it portals into are built by the constructor above, so they exist only once that state is set.
	return (
		<>
			<div className="sim-app" ref={mountRef} />
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
