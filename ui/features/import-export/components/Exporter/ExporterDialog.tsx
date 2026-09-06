import type { ComponentType } from 'react';

import type { ExporterDefinition } from '../../exporters';
import { Exporter } from './Exporter';

export interface ExporterDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/**
 * Binds one exporter definition into the open/onOpenChange-only shape the header menu renders.
 *
 * The registry entry cannot be JSX: `app/individual_sim_ui.tsx` still carries the vanilla JSX
 * pragma, so anything it writes in angle brackets compiles to DOM nodes rather than elements. It
 * registers the component this returns instead, one line per exporter, where it used to construct
 * one class per exporter.
 */
export const exporterDialog = (definition: ExporterDefinition): ComponentType<ExporterDialogProps> => {
	const ExporterDialog = ({ open, onOpenChange }: ExporterDialogProps) => <Exporter open={open} onOpenChange={onOpenChange} {...definition} />;
	ExporterDialog.displayName = `ExporterDialog(${definition.title})`;
	return ExporterDialog;
};
