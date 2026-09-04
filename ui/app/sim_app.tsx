// The React root of a spec page.
//
// Phase 1a of the React migration: React owns the page root, but the shell it contains is still the
// existing imperative `IndividualSimUI`. The rendered DOM below `.sim-ui` is therefore unchanged —
// that is the property the DOM-parity gate checks.
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
	// The shell is constructed exactly once, and the effect has no cleanup. Both are deliberate.
	//
	// Constructing it is not an undoable act: `loadIndividualSettings` subscribes autosave and hands
	// back no unsubscribe, five warnings are registered on the results viewer, and `loadSettings` is
	// queued on `sim.waitForInit()` — a promise that resolves whether or not anything was disposed.
	// So `dispose()` could not undo a second construction, and StrictMode's double-invoked effect
	// would produce a genuinely double-initialised page.
	//
	// A page has exactly one sim shell for its whole lifetime, so a construct-once gate states that
	// honestly rather than pretending the lifecycle is reversible. The ref survives StrictMode's
	// mount/unmount/mount because React keeps the same component instance.
	const constructed = useRef(false);
	// Held in state so the tab controller can render once the shell's containers exist.
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
