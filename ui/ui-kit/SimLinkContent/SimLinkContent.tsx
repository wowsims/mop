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
	<div className="ui-sim-link-content">
		<img src={iconPath} className={clsx('ui-sim-link-icon', iconClassName)} data-testid="sim-link-icon" alt="" />
		<div className="flex flex-col">
			{label !== undefined && (
				<span className={clsx('ui-sim-link-label', labelClassName)} data-testid="sim-link-label">
					{label}
				</span>
			)}
			<span className="ui-sim-link-title" data-testid="sim-link-title">
				{title}
			</span>
			{status && (
				<span className="ui-sim-link-status text-brand" data-testid="launch-status-label">
					{status}
				</span>
			)}
		</div>
	</div>
);
