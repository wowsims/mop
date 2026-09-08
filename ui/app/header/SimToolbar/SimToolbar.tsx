import { REPO_CHOOSE_NEW_ISSUE_URL, REPO_RELEASES_URL, SOCIALS } from '@sim/constants/other';
import { useOutdatedNativeSim } from '@sim/hooks/useOutdatedNativeSim';
import type { Sim } from '@sim/sim';
import i18n from '@i18n/config';
import { isNative } from '@ui-kit/dom_utils';
import type { ReactNode } from 'react';

import { SocialLink } from '@ui-kit/SocialLink';
import { ToolbarItem } from './ToolbarItem';

export interface SimToolbarProps {
	// The toolbar renders inside the shell, which is built before `IndividualSimUI` adopts it, so
	// there is no `SimHostProvider` above it to read the sim from.
	sim: Sim;
	knownIssues: ReadonlyArray<ReactNode>;
	onOpenSettings: () => void;
}

export const SimToolbar = ({ sim, knownIssues, onOpenSettings }: SimToolbarProps) => {
	const outdatedNativeSim = useOutdatedNativeSim(sim);

	return (
		<>
			<ToolbarItem
				className="known-issues link-danger"
				hidden={knownIssues.length === 0}
				tooltip={
					<ul className="text-start ps-3 mb-0">
						{knownIssues.map((issue, index) => (
							<li key={index}>{issue}</li>
						))}
					</ul>
				}>
				{i18n.t('info.known_issues')}
			</ToolbarItem>

			<ToolbarItem href={REPO_CHOOSE_NEW_ISSUE_URL} icon="bug" tooltip={i18n.t('info.bug_report')} />

			{!isNative() && <ToolbarItem href={REPO_RELEASES_URL} icon="gauge-high" className="downbin" tooltip="Download simulator for faster simulating" />}

			<ToolbarItem className="sim-options" icon="cog" tooltip={i18n.t('info.sim_options')} onClick={onOpenSettings} />

			<div className="sim-toolbar-socials">
				{SOCIALS.map(social => (
					<div key={social.key} className="sim-toolbar-item">
						<SocialLink social={social} />
					</div>
				))}
			</div>

			{outdatedNativeSim && (
				<ToolbarItem
					href={REPO_RELEASES_URL}
					icon="gauge-high"
					className="downbin link-danger"
					tooltip="Newer version of simulator available for download"
				/>
			)}
		</>
	);
};
