import { useSimHost } from '@sim/context/SimHostContext';
import { kebabCase } from '@sim/utils/format';
import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { Dialog } from '@ui-kit/Dialog';
import { downloadString } from '@ui-kit/utils/dom';
import { useCopyToClipboard } from '@ui-kit/hooks/useCopyToClipboard';
import { Icon } from '@ui-kit/Icon';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { trackPageView } from '../../../../tracking/analytics';
import { defaultExportCategories, type ExporterDefinition } from '../../exporters';
import { ExporterCategoryPickers } from './ExporterCategoryPickers';

export interface ExporterProps extends ExporterDefinition {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export const Exporter = ({
	open,
	onOpenChange,
	title,
	allowDownload = false,
	downloadFileName = 'wowsims.json',
	downloadMimeType,
	selectCategories = false,
	getData,
}: ExporterProps) => {
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

	const copyTooltipId = useId();
	const { copy, copied } = useCopyToClipboard(() => dataRef.current);

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			className="exporter"
			container={host.rootElem}
			title={title}
			footer={
				<>
					<Button className="copy-button" onClick={copy} {...tooltipAnchorProps(copyTooltipId)}>
						<Icon name={copied ? 'check' : 'copy'} className="me-1" />
						{copied ? i18n.t('common.copy_button.copied') : i18n.t('export.json.copy_button')}
					</Button>
					{allowDownload && (
						<Button
							className="exporter-button download-button ms-2"
							onClick={() => downloadString(dataRef.current, downloadFileName, downloadMimeType)}>
							<Icon name="download" style="base" className="me-1" />
							{i18n.t('export.json.download_button')}
						</Button>
					)}
					<Tooltip id={copyTooltipId} content={i18n.t('export.json.copy_tooltip')} />
				</>
			}>
			{selectCategories && <ExporterCategoryPickers categories={categories.current} onChange={onCategoryChange} />}
			{/* `defaultValue` for the mount, the effect above for a change while open: the popup mounts a commit after the effect first runs, so a ref write alone leaves the box empty. */}
			<textarea spellCheck={false} className="exporter-textarea form-control" ref={textRef} defaultValue={data} />
		</Dialog>
	);
};
