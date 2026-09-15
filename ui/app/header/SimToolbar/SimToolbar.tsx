import i18n from '@i18n/config';
import { REPO_CHOOSE_NEW_ISSUE_URL, REPO_RELEASES_URL, SOCIALS } from '@sim/constants/other';
import { useOutdatedNativeSim } from '@sim/hooks/useOutdatedNativeSim';
import type { Sim } from '@sim/sim';
import { SocialLink } from '@ui-kit/SocialLink';
import { isNative } from '@ui-kit/utils/dom';
import type { ReactNode } from 'react';

import { ToolbarItem } from './ToolbarItem';

export interface SimToolbarProps {
	// The toolbar renders inside the shell, which is built before `SimHostObject` adopts it, so
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
				className="text-link-danger"
				testId="known-issues"
				hidden={knownIssues.length === 0}
				tooltip={
					<ul className="mb-0 pl-4 text-left">
						{knownIssues.map((issue, index) => (
							<li key={index}>{issue}</li>
						))}
					</ul>
				}>
				{i18n.t('info.known_issues')}
			</ToolbarItem>

			<ToolbarItem href={REPO_CHOOSE_NEW_ISSUE_URL} icon="bug" tooltip={i18n.t('info.bug_report')} />

			{!isNative() && <ToolbarItem href={REPO_RELEASES_URL} icon="gauge-high" tooltip="Download simulator for faster simulating" />}

			<ToolbarItem testId="sim-options" icon="cog" tooltip={i18n.t('info.sim_options')} onClick={onOpenSettings} />

			<div className="mt-2 mb-2 ml-4 flex border-l border-l-border [&_a]:my-2 [&_button]:my-2" data-testid="sim-toolbar-socials">
				{SOCIALS.map(social => (
					<div key={social.key} className="ml-4 flex transition-colors duration-150 ease-in-out" data-testid="sim-toolbar-item">
						<SocialLink social={social} />
					</div>
				))}
			</div>

			{outdatedNativeSim && (
				<ToolbarItem
					href={REPO_RELEASES_URL}
					icon="gauge-high"
					className="text-link-danger"
					tooltip="Newer version of simulator available for download"
				/>
			)}
		</>
	);
};
