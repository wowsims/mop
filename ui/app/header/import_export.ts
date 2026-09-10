export enum ImportExportKind {
	Import = 'import',
	Export = 'export',
}

export interface ImportExportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}
