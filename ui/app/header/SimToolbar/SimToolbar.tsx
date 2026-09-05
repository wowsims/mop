import { REPO_CHOOSE_NEW_ISSUE_URL, REPO_RELEASES_URL, REPO_URL } from '@domain/constants/other';
import { noop } from '@domain/utils';
import i18n from '@i18n/config';
import { isNative } from '@ui-kit/dom_utils';
import { type ReactNode, useEffect, useState } from 'react';

import { SocialItem } from './SocialItem';
import { ToolbarItem } from './ToolbarItem';

export interface SimToolbarProps {
	/** Rendered as a list in the known-issues tooltip; the link hides when there are none. */
	knownIssues: ReadonlyArray<ReactNode>;
	onOpenSettings: () => void;
}

const SOCIALS = [
	{ key: 'discord', href: 'https://discord.gg/p3DgvmnDCS', className: 'discord-link link-alt', icon: 'fab fa-discord fa-lg', tooltip: 'info.discord' },
	{ key: 'github', href: REPO_URL, className: 'github-link link-alt', icon: 'fab fa-github fa-lg', tooltip: 'info.github' },
	{ key: 'patreon', href: 'https://patreon.com/wowsims', className: 'patreon-link link-alt', icon: 'fab fa-patreon fa-lg', tooltip: 'info.patreon' },
] as const;

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

			<ToolbarItem href={REPO_CHOOSE_NEW_ISSUE_URL} icon="fas fa-bug fa-lg" tooltip={i18n.t('info.bug_report')} />

			{!isNative() && (
				<ToolbarItem href={REPO_RELEASES_URL} icon="fas fa-gauge-high fa-lg" className="downbin" tooltip="Download simulator for faster simulating" />
			)}

			<ToolbarItem className="sim-options" icon="fas fa-cog fa-lg" tooltip={i18n.t('info.sim_options')} onClick={onOpenSettings} />

			<div className="sim-toolbar-socials">
				{SOCIALS.map(social => (
					<SocialItem key={social.key} href={social.href} className={social.className} icon={social.icon} tooltip={i18n.t(social.tooltip)}>
						{/* Patreon is the only one that spells itself out beside the glyph. */}
						{social.key === 'patreon' && ' Patreon'}
					</SocialItem>
				))}
			</div>

			{/* Last, and not in call order: vanilla appended this once the `/version` fetch resolved,
			    which is after the socials were already in the DOM. */}
			{outdatedNativeSim && (
				<ToolbarItem
					href={REPO_RELEASES_URL}
					icon="fas fa-gauge-high fa-lg"
					className="downbin link-danger"
					tooltip="Newer version of simulator available for download"
				/>
			)}
		</>
	);
};
