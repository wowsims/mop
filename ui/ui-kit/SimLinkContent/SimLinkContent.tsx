import clsx from 'clsx';

export interface SimLinkContentProps {
	iconPath: string;
	iconClassName?: string;
	label?: string;
	labelIsWhite?: boolean;
	title: string;
	/** Already-translated launch text: the sim header spells out phase and status, the landing page only the status. */
	status?: string;
}

export const SimLinkContent = ({ iconPath, iconClassName, label, labelIsWhite, title, status }: SimLinkContentProps) => (
	<div className="sim-link-content">
		<img src={iconPath} className={clsx('sim-link-icon', iconClassName)} alt="" />
		<div className="d-flex flex-column">
			{label !== undefined && <span className={clsx('sim-link-label', labelIsWhite && 'text-white')}>{label}</span>}
			<span className="sim-link-title">{title}</span>
			{status && <span className="launch-status-label text-brand">{status}</span>}
		</div>
	</div>
);
