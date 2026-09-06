import { REPO_CHOOSE_NEW_ISSUE_URL, REPO_RELEASES_URL, SOCIALS } from '@domain/constants/other';
import { noop } from '@domain/utils';
import i18n from '@i18n/config';
import { isNative } from '@ui-kit/dom_utils';
import { type ReactNode, useEffect, useState } from 'react';

import { SocialLink } from '../../SocialLink';
import { ToolbarItem } from './ToolbarItem';

export interface SimToolbarProps {
	/** Rendered as a list in the known-issues tooltip; the link hides when there are none. */
	knownIssues: ReadonlyArray<ReactNode>;
	onOpenSettings: () => void;
}

/**
 * Asks the local sim host whether a newer build exists. Only the "outdated" answer renders anything,
 * and only when running against a local host at all — which is why this link is invisible to a gate
 * unless `/version` is answered for it (`tools/react-migration/header-toolbar.mjs` does).
 *
 * The two `catch`es are not one: a failed request is silent, a reply that will not parse warns. That
 * is vanilla's split and it is the useful one — the first means "not a sim host", the second means
 * "a sim host that answered something unexpected".
 */
const useOutdatedNativeSim = () => {
	const [outdated, setOutdated] = useState(false);
	useEffect(() => {
		if (!isNative()) return;
		let cancelled = false;
		fetch('/version')
			.then(response =>
				response
					.json()
					.then(versionInfo => {
						if (!cancelled && versionInfo.outdated == 2) setOutdated(true);
					})
					.catch(() => console.warn('No version info found!')),
			)
			.catch(noop);
		return () => {
			cancelled = true;
		};
	}, []);
	return outdated;
};

/** The right-hand end of the header: known issues, bug report, the cog, and the socials. */
export const SimToolbar = ({ knownIssues, onOpenSettings }: SimToolbarProps) => {
	const outdatedNativeSim = useOutdatedNativeSim();

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
					// The toolbar wraps each link the way it wraps every other item; the sidebar does not.
					<div key={social.key} className="sim-toolbar-item">
						<SocialLink social={social} />
					</div>
				))}
			</div>

			{/* Last, and not in call order: vanilla appended this once the `/version` fetch resolved,
			    which is after the socials were already in the DOM. */}
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
