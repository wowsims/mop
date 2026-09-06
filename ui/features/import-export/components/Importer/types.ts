/**
 * What the header menu hands an importer dialog, and the whole of its prop surface.
 *
 * All four importer dialogs share it because the menu decides it, not they do: a React dialog has
 * no `open()` for `ImportExportRegistry` to call, so the menu renders the component and owns which
 * one is showing. `ImportExportDialogProps` in `app/header/import_export_registry.ts` is the
 * registry's own statement of the same shape — declared there rather than imported from here,
 * because `ui/features` and `ui/app` are separate layers.
 */
export interface ImporterDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}
