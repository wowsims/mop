// Still declared here because `sim/spec_config.ts` — frozen for the migration — imports it from
// this path. Everything else this file held (`makeTargetsPicker`, `makeTargetInputsPicker`,
// `TargetPicker`, `TargetInputPicker`) is `components/TargetsPicker/` now: one consumer each, so
// not dual-stack.
export interface EncounterPickerConfig {
	showExecuteProportion: boolean;
}
