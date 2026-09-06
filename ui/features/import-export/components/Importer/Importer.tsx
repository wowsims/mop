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
	children?: ReactNode;
}

export const Importer = ({ open, onOpenChange, title, allowFileUpload = false, onImport, children }: ImporterProps) => {
	const host = useSimHost();
	const textRef = useRef<HTMLTextAreaElement>(null);
	const uploadInputId = `upload-input-${kebabCase(title)}`;

	useEffect(() => {
		if (!open) return;
		trackPageView(title, `/import/${kebabCase(title)}`);
	}, [open, title]);

	const runImport = async () => {
		try {
			await onImport(host, textRef.current?.value || '');
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
					{allowFileUpload && (
						<label htmlFor={uploadInputId} className="importer-button btn btn-primary upload-button">
							<Icon name="file-arrow-up" className="me-1" />
							{i18n.t('import.json.upload_button')}
						</label>
					)}
					<input
						type="file"
						id={uploadInputId}
						className="importer-upload-input d-none"
						hidden
						onChange={async event => {
							const file = event.target.files?.[0];
							if (!file || !textRef.current) return;
							textRef.current.value = await file.text();
						}}
					/>
					<Button className="importer-button import-button" onClick={runImport}>
						<Icon name="download" style="base" className="me-1" />
						{i18n.t('import.json.import_button')}
					</Button>
				</div>
			}>
			<div>
				<div className="import-description">{children}</div>
				<textarea spellCheck={false} className="importer-textarea form-control" ref={textRef} />
			</div>
		</Dialog>
	);
};
