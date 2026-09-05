import type { Player } from '@domain/player';
import type { SpecDefinition } from '@features/spec_config';
import type { Spec } from '@generated/proto/common';
import { useLayoutEffect, useRef, useState } from 'react';

import { IndividualSimUI } from './individual_sim_ui';
import { SimTabs } from './sim_tabs';

export interface SimAppProps<SpecType extends Spec> {
	player: Player<SpecType>;
	def: SpecDefinition<SpecType>;
}

export function SimApp<SpecType extends Spec>({ player, def }: SimAppProps<SpecType>) {
	const mountRef = useRef<HTMLDivElement>(null);
	// Constructing the shell is not undoable — loadIndividualSettings subscribes autosave and returns
	// no unsubscribe — so it happens once and StrictMode's second pass is a no-op.
	const constructed = useRef(false);
	const [simUI, setSimUI] = useState<IndividualSimUI<SpecType> | null>(null);

	useLayoutEffect(() => {
		if (constructed.current || !mountRef.current) return;
		constructed.current = true;
		setSimUI(new IndividualSimUI(mountRef.current, player, def));
	}, [player, def]);

	return (
		<>
			<div className="sim-app" ref={mountRef} />
			{simUI && <SimTabs registry={simUI.tabs} strip={simUI.simHeader.simTabsContainer} panes={simUI.simTabContentsContainer} />}
		</>
	);
}
