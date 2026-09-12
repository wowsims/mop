import { useSimHost } from '@sim/context/SimHostContext';
import i18n from '@i18n/config';
import { Dialog } from '@ui-kit/Dialog';
import { useSyncExternalStore } from 'react';

import type { CrashReportOpener } from './crash_report_opener';

export interface CrashReportDialogProps {
	opener: CrashReportOpener;
}

export const CrashReportDialog = ({ opener }: CrashReportDialogProps) => {
	const host = useSimHost();
	const open = useSyncExternalStore(opener.subscribe, opener.isOpen);
	const link = useSyncExternalStore(opener.subscribe, opener.getLink);

	return (
		<Dialog open={open} onOpenChange={opener.setOpen} className="crash" container={host.rootElem} title={i18n.t('sim.crash_modal.title')}>
			<div className="sim-crash-report">
				<h3 className="sim-crash-report-header">{i18n.t('sim.crash_modal.header')}</h3>
				{/* Keyed so a second crash replaces the text: the field is uncontrolled. */}
				<textarea key={link} className="sim-crash-report-text form-control" defaultValue={link} />
			</div>
		</Dialog>
	);
};
