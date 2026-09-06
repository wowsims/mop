import { kebabCase } from '@domain/format';
import { useSimHost } from '@features/SimHostContext';
import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { CopyButton } from '@ui-kit/copy_button';
import { Dialog } from '@ui-kit/Dialog';
import { downloadString } from '@ui-kit/dom_utils';
import { useLegacyMount } from '@ui-kit/hooks/useLegacyMount';
import { Icon } from '@ui-kit/Icon';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { trackPageView } from '../../../../tracking/analytics';
import { defaultExportCategories, type ExporterDefinition } from '../../exporters';
import { ExporterCategoryPickers } from './ExporterCategoryPickers';

export interface ExporterProps extends ExporterDefinition {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/**
 * Every exporter, as one dialog.
 *
 * It replaces a three-level class hierarchy — `view/exporter.tsx` built the textarea and the footer,
 * `view/exporters/individual_exporter.tsx` prepended the category pickers, and each concrete
 * exporter added a `getData()` — because nothing above `getData` varied between them. What did vary
 * is these props, and the concrete exporters are data now (`../../exporters`).
 *
 * `container` is the sim root, not `<body>`: the copy and download buttons are `.btn-primary`, and
 * `scss/sims/sim.scss` scopes `--bs-primary` and the whole `--theme-*` set to `.<spec>-sim-ui`. A
 * body-portaled dialog paints them Bootstrap blue on white. See `Dialog`'s own note.
 *
 * `keepMounted`, because the vanilla exporters were built at construction and never disposed —
 * `parity.mjs` compares the modals under `.sim-ui` as a set, so a dialog that vanishes when closed
 * is a diff on every spec.
 */
export const Exporter = ({ open, onOpenChange, title, allowDownload = false, selectCategories = false, getData }: ExporterProps) => {
	const host = useSimHost();
	const textRef = useRef<HTMLTextAreaElement>(null);
	// Mutable and stable for the dialog's lifetime, the way the vanilla exporter held
	// `this.exportCategories`. `useInput` keys its subscription on the modObject's identity, so a
	// fresh record per tick would resubscribe all seven pickers on every one of them.
	const categories = useRef(defaultExportCategories());
	const [categoryRevision, setCategoryRevision] = useState(0);
	const onCategoryChange = useCallback(() => setCategoryRevision(revision => revision + 1), []);

	// Only while open. Vanilla built the text in `init()`, which only `open()` called, and rebuilt it
	// on every category change — never while closed, and these walk the whole player.
	const data = useMemo(
		() => (open ? getData(host, categories.current) : ''),
		// `categories` is a ref, so the revision counter is what says its contents moved.
		// oxlint-disable-next-line react-hooks/exhaustive-deps
		[open, categoryRevision, host, getData],
	);
	// Read by the two footer buttons, which are built once and must not close over a stale render.
	const dataRef = useRef(data);
	dataRef.current = data;

	// Uncontrolled and synced imperatively: vanilla wrote `textContent`, which is a textarea's
	// *default* value, and left the field editable. A React `value` would need an `onChange` or a
	// `readOnly` the vanilla field did not have.
	useEffect(() => {
		if (textRef.current) textRef.current.value = data;
	}, [data]);

	useEffect(() => {
		if (!open) return;
		trackPageView(title, `/export/${kebabCase(title)}`);
	}, [open, title]);

	// Vanilla, on the dual-stack rule: `CopyButton` has callers that have not ported. `useLegacyMount`
	// rather than `LegacyHost` for the usual reason, and the div it mounts into is the one element
	// this footer has that vanilla's did not.
	const mountCopyButton = useLegacyMount(
		parent =>
			new CopyButton(parent, {
				extraCssClasses: ['btn-primary'],
				getContent: () => dataRef.current,
				text: i18n.t('export.json.copy_button'),
				tooltip: i18n.t('export.json.copy_tooltip'),
			}),
		[],
	);

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			cssClass="exporter"
			container={host.rootElem}
			keepMounted
			title={title}
			footer={
				<>
					<div ref={mountCopyButton} />
					{allowDownload && (
						<Button className="exporter-button download-button ms-2" onClick={() => downloadString(dataRef.current, 'wowsims.json')}>
							{/* Bare `fa`, which `Icon`'s closed union cannot emit — the same case as the header's
							    dropdown triggers. */}
							<Icon name="download" style="base" className="me-1" />
							{i18n.t('export.json.download_button')}
						</Button>
					)}
				</>
			}>
			{selectCategories && <ExporterCategoryPickers categories={categories.current} onChange={onCategoryChange} />}
			<textarea spellCheck={false} className="exporter-textarea form-control" ref={textRef} />
		</Dialog>
	);
};
