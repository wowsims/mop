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

export const Exporter = ({ open, onOpenChange, title, allowDownload = false, selectCategories = false, getData }: ExporterProps) => {
	const host = useSimHost();
	const textRef = useRef<HTMLTextAreaElement>(null);
	const categories = useRef(defaultExportCategories());
	const [categoryRevision, setCategoryRevision] = useState(0);
	const onCategoryChange = useCallback(() => setCategoryRevision(revision => revision + 1), []);

	const data = useMemo(
		() => (open ? getData(host, categories.current) : ''),
		// `categories` is a ref, so the revision counter is what says its contents moved.
		// oxlint-disable-next-line react-hooks/exhaustive-deps
		[open, categoryRevision, host, getData],
	);
	const dataRef = useRef(data);
	dataRef.current = data;

	useEffect(() => {
		if (textRef.current) textRef.current.value = data;
	}, [data]);

	useEffect(() => {
		if (!open) return;
		trackPageView(title, `/export/${kebabCase(title)}`);
	}, [open, title]);

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
