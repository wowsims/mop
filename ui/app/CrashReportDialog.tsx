import i18n from '@i18n/config';
import { Dialog } from '@ui-kit/Dialog';
import { TextArea } from '@ui-kit/FormControl';
import { useSyncExternalStore } from 'react';

import type { CrashReportOpener } from './crash_report_opener';

export interface CrashReportDialogProps {
	opener: CrashReportOpener;
}

export const CrashReportDialog = ({ opener }: CrashReportDialogProps) => {
	const open = useSyncExternalStore(opener.subscribe, opener.isOpen);
	const link = useSyncExternalStore(opener.subscribe, opener.getLink);

	return (
		<Dialog open={open} onOpenChange={opener.setOpen} title={i18n.t('sim.crash_modal.title')}>
			<div>
				<h3 className="text-base">{i18n.t('sim.crash_modal.header')}</h3>
				{/* Keyed so a second crash replaces the text: the field is uncontrolled. */}
				<TextArea key={link} className="h-[80vh] resize-none" defaultValue={link} data-testid="sim-crash-report-text" />
			</div>
		</Dialog>
	);
};
