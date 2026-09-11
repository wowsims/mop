import clsx, { type ClassValue } from 'clsx';

export interface SimLinkContentProps {
	iconPath: string;
	iconClassName?: ClassValue;
	label?: string;
	labelClassName?: ClassValue;
	title: string;
	/** Already-translated launch text: the sim header spells out phase and status, the landing page only the status. */
	status?: string;
}

export const SimLinkContent = ({ iconPath, iconClassName, label, labelClassName, title, status }: SimLinkContentProps) => (
	<div className="sim-link-content">
		<img src={iconPath} className={clsx('sim-link-icon', iconClassName)} alt="" />
		<div className="d-flex flex-column">
			{label !== undefined && <span className={clsx('sim-link-label', labelClassName)}>{label}</span>}
			<span className="sim-link-title">{title}</span>
			{status && <span className="launch-status-label text-brand">{status}</span>}
		</div>
	</div>
);
