import i18n from '@i18n/config';
import { translateStatus } from '@i18n/localization';
import clsx from 'clsx';

export interface SimLinkContentProps {
	iconPath: string;
	label?: string;
	labelIsWhite?: boolean;
	title: string;
	launch?: { phase: number; status: number };
}

export const SimLinkContent = ({ iconPath, label, labelIsWhite, title, launch }: SimLinkContentProps) => (
	<div className="sim-link-content">
		<img src={iconPath} className="sim-link-icon" alt="" />
		<div className="d-flex flex-column">
			{label !== undefined && <span className={clsx('sim-link-label', labelIsWhite && 'text-white')}>{label}</span>}
			<span className="sim-link-title">{title}</span>
			{launch && (
				<span className="launch-status-label text-brand">
					{i18n.t('sidebar.header.phase', { phase: i18n.t(`common.phases.${launch.phase}`), status: translateStatus(launch.status) })}
				</span>
			)}
		</div>
	</div>
);
