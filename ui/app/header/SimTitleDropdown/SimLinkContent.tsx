import i18n from '@i18n/config';
import { translateStatus } from '@i18n/localization';
import clsx from 'clsx';

export interface SimLinkContentProps {
	iconPath: string;
	/** The small line above the title: "Simulator" on the root, the class name on a spec link. */
	label?: string;
	/** The root's label is white; a spec link's takes the class colour it inherits. */
	labelIsWhite?: boolean;
	title: string;
	/** Only specs have one; a class row shows no phase. */
	launch?: { phase: number; status: number };
}

/** The inside of every row in this menu — icon, optional label, title, optional launch status. */
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
