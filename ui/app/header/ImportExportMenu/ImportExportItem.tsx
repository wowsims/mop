import type { ComponentType } from 'react';

import type { ImportExportDialogProps } from '../import_export';

export interface ImportExportItemProps {
	label: string;
	dialog: ComponentType<ImportExportDialogProps>;
	isUnsupported?: boolean;
}

// A declaration, never rendered: `ImportExportMenu` reads these props off its children and splits
// them between the dropdown items and the dialogs it mounts outside the popup.
export const ImportExportItem = (_props: ImportExportItemProps): null => null;
