import { LaunchStatus } from '@domain/constants/other';
import type { SimStatus } from '@domain/player_spec';
import i18n from '@i18n/config';
import type { ReactNode } from 'react';

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

export const knownIssuesFor = (simStatus: SimStatus, knownIssues?: ReadonlyArray<ReactNode>): ReactNode[] => {
	const notice = statusNotice(simStatus.status);
	return [...(notice ? [notice] : []), ...(knownIssues ?? []), ...globalKnownIssues];
};
