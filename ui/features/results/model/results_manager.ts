import type { SimResult } from '@sim/proto/sim_result';
import type { Sim } from '@sim/sim';
import { batch } from '@sim/state/batch';
import { Emitter } from '@sim/state/events';
import { Raid as RaidProto } from '@generated/proto/api';
import { Encounter as EncounterProto } from '@generated/proto/common';
import { SimRunData } from '@generated/proto/ui';

import type { ReferenceData } from './sim_results';

export type SimResultsData = {
	current: ReferenceData | null;
	reference: ReferenceData | null;
};

// The run the sidebar shows and the run it is compared against. Events (results arrived / reference
// set or swapped), not state, so the two emitters stay separate: a swap changes both and notifies
// each once.
export class SimResultsManager {
	readonly currentChangeEmitter = new Emitter<void>();
	readonly referenceChangeEmitter = new Emitter<void>();

	private currentData: ReferenceData | null = null;
	private referenceData: ReferenceData | null = null;
	private readonly sim: Sim;

	constructor(sim: Sim) {
		this.sim = sim;
	}

	readonly subscribe = (listener: () => void): (() => void) => {
		const offCurrent = this.currentChangeEmitter.on(listener);
		const offReference = this.referenceChangeEmitter.on(listener);
		return () => {
			offCurrent();
			offReference();
		};
	};

	readonly getData = (): SimResultsData => ({ current: this.currentData, reference: this.referenceData });

	setSimResult(simResult: SimResult) {
		this.currentData = {
			simResult: simResult,
			settings: {
				raid: RaidProto.toJson(this.sim.raid.toProto()),
				encounter: EncounterProto.toJson(this.sim.encounter.toProto()),
			},
			raidProto: RaidProto.clone(simResult.request.raid || RaidProto.create()),
			encounterProto: EncounterProto.clone(simResult.request.encounter || EncounterProto.create()),
		};

		this.currentChangeEmitter.emit();
	}

	setReference() {
		this.referenceData = this.currentData;
		this.referenceChangeEmitter.emit();
	}

	clearReference() {
		this.referenceData = null;
		this.referenceChangeEmitter.emit();
	}

	swapReference() {
		const { currentData, referenceData } = this;
		if (!currentData || !referenceData) return;

		batch(() => {
			this.referenceData = currentData;

			// Restored before `setSimResult`, which rebuilds `currentData` from the sim's settings as
			// they are now — so the raid and encounter have to be back first.
			this.sim.raid.fromProto(referenceData.raidProto);
			this.sim.encounter.fromProto(referenceData.encounterProto);
			this.setSimResult(referenceData.simResult);

			this.referenceChangeEmitter.emit();
		});
	}

	getRunData(): SimRunData | null {
		if (!this.currentData) {
			return null;
		}

		return SimRunData.create({
			run: this.currentData.simResult.toProto(),
			referenceRun: this.referenceData?.simResult.toProto(),
		});
	}
}
