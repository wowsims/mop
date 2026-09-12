import type { ComponentType } from 'react';

import type { ExporterDefinition } from '../../exporters';
import { Exporter } from './Exporter';

export interface ExporterDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export const exporterDialog = (definition: ExporterDefinition): ComponentType<ExporterDialogProps> => {
	const ExporterDialog = ({ open, onOpenChange }: ExporterDialogProps) => <Exporter open={open} onOpenChange={onOpenChange} {...definition} />;
	ExporterDialog.displayName = `ExporterDialog(${definition.title})`;
	return ExporterDialog;
};
