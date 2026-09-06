import { kebabCase } from '@domain/format';
import { useSimHost } from '@features/SimHostContext';
import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { Dialog } from '@ui-kit/Dialog';
import { Icon } from '@ui-kit/Icon';
import Toast from '@ui-kit/toast';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import { trackPageView } from '../../../../tracking/analytics';
import type { ImporterDefinition } from '../../importers';

export interface ImporterProps extends ImporterDefinition {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The block above the textarea: what this importer imports, and where to get it from. */
	children?: ReactNode;
}

/**
 * Every importer, as one dialog — the mirror of `Exporter` beside it.
 *
 * It parameterises the three things that varied across the vanilla hierarchy (`title`,
 * `allowFileUpload`, `onImport`) plus the description, and fixes the rest: the textarea, the upload
 * label and its hidden input, the import button, and that a rejected `onImport` becomes an error
 * toast while the dialog stays open.
 *
 * `container` is the sim root and not `<body>`: the two footer controls are `.btn-primary`, and
 * `scss/sims/sim.scss` scopes `--bs-primary` and the `--theme-*` set to `.<spec>-sim-ui`. See
 * `Dialog`'s own note. `keepMounted` is `disposeOnClose: false`, which is what the vanilla
 * importers were built with.
 */
export const Importer = ({ open, onOpenChange, title, allowFileUpload = false, onImport, children }: ImporterProps) => {
	const host = useSimHost();
	const textRef = useRef<HTMLTextAreaElement>(null);
	// Vanilla derived this from the title too, and it is what ties the label to the input. Three
	// importers are mounted at once under `keepMounted`, so it has to differ per importer.
	const uploadInputId = `upload-input-${kebabCase(title)}`;

	// DEFECT FIXED. Vanilla read `this.header.title` — `this.header` is the `.modal-header`
	// *element*, so its `title` is the (absent) HTML attribute and every import page view was logged
	// with an empty title and the slug `/import/`. Same bug the exporter port fixed.
	useEffect(() => {
		if (!open) return;
		trackPageView(title, `/import/${kebabCase(title)}`);
	}, [open, title]);

	const runImport = async () => {
		try {
			await onImport(host, textRef.current?.value || '');
			// Every vanilla importer ended in `this.close()` — directly, or through the shared tail in
			// `IndividualImporter`. It is the shell's job here, so a definition is only the parse.
			onOpenChange(false);
		} catch (error: any) {
			new Toast({ variant: 'error', body: `Import error: ${error?.message || error}` });
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			cssClass="importer"
			container={host.rootElem}
			keepMounted
			title={title}
			footer={
				<div className="d-flex gap-2">
					{/* A real `<label>`: it has `htmlFor` and a real control behind it, which is the
					    distinction that decides the label-or-span question every time. */}
					{allowFileUpload && (
						<label htmlFor={uploadInputId} className="importer-button btn btn-primary upload-button">
							<Icon name="file-arrow-up" className="me-1" />
							{i18n.t('import.json.upload_button')}
						</label>
					)}
					{/* Rendered whether or not uploading is allowed, as vanilla did — only the label is
					    conditional there. */}
					<input
						type="file"
						id={uploadInputId}
						className="importer-upload-input d-none"
						hidden
						onChange={async event => {
							const file = event.target.files?.[0];
							// DEFECT FIXED, twice over. Vanilla read `files[0]` unguarded, so a cancelled
							// picker threw inside the listener; and it wrote `textContent`, which is a
							// textarea's *default* value — a field the user had already typed in ignored the
							// upload and imported the typed text instead.
							if (!file || !textRef.current) return;
							textRef.current.value = await file.text();
						}}
					/>
					<Button className="importer-button import-button" onClick={runImport}>
						{/* Bare `fa`, which is what the vanilla button spelled. */}
						<Icon name="download" style="base" className="me-1" />
						{i18n.t('import.json.import_button')}
					</Button>
				</div>
			}>
			<div>
				<div className="import-description">{children}</div>
				{/* Uncontrolled, as vanilla left it: the field is the user's to type in, and the only
				    writer is the upload handler above. */}
				<textarea spellCheck={false} className="importer-textarea form-control" ref={textRef} />
			</div>
		</Dialog>
	);
};
