// The fight the sim starts with. These seven numbers were written out three
// times — Encounter.defaultEncounterProto(), the store's initial encounter
// slice, and the Malkorok preset — so they live here instead. This module is a
// leaf on purpose: state/sim_store.ts seeds itself from it and cannot import
// encounter.ts without a cycle.
export const ENCOUNTER_DEFAULTS = {
	duration: 300,
	durationVariation: 60,
	executeProportion20: 0.2,
	executeProportion25: 0.25,
	executeProportion35: 0.35,
	executeProportion45: 0.45,
	executeProportion90: 0.9,
} as const;
