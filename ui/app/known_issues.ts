import { LaunchStatus } from '@domain/constants/other';
import type { SimStatus } from '@domain/player_spec';
import i18n from '@i18n/config';
import type { ReactNode } from 'react';

// Shown on every spec, ahead of that spec's own issues. Empty today; it is the hook that matters.
const globalKnownIssues: ReactNode[] = [];

const statusNotice = (status: LaunchStatus): string => {
	switch (status) {
		case LaunchStatus.Unlaunched:
			return i18n.t('info.status.unlaunched');
		case LaunchStatus.Alpha:
			return i18n.t('info.status.alpha');
		case LaunchStatus.Beta:
			return i18n.t('info.status.beta');
		default:
			return '';
	}
};

/**
 * The list behind the header's known-issues link: the notice a spec's launch status earns, then the
 * spec's own issues, then anything global.
 *
 * A function rather than a field on the config, because `SimUI.addKnownIssues` used to *prepend the
 * status notice into `config.knownIssues` itself* — mutating the frozen spec surface on the way past.
 * Nothing read it afterwards, so nothing depended on that; deriving it makes it impossible to.
 */
export const knownIssuesFor = (simStatus: SimStatus, knownIssues?: ReadonlyArray<ReactNode>): ReactNode[] => {
	const notice = statusNotice(simStatus.status);
	return [...(notice ? [notice] : []), ...(knownIssues ?? []), ...globalKnownIssues];
};
