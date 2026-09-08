/**
 * The exporter dialog lives in the import-export feature; results/ must not import another feature's
 * view, so the host builds it and passes it down. It sits here rather than beside the log view
 * because `individual_sim_ui` — a vanilla-pragma file — is the one that supplies it.
 */
export type LogExporterFactory = (getLogData: () => string) => { open: () => void };
