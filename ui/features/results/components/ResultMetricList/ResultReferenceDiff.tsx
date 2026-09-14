import i18n from '@i18n/config';
import { tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';

import type { ReferenceDiff } from '../../model/reference_diffs';

export interface ResultReferenceDiffProps {
	diff?: ReferenceDiff;
	tooltipId?: string;
}

/** The delta against the saved reference run. Every layout renders the slot; only the sidebar, and only once a reference is set, fills it in. */
export const ResultReferenceDiff = ({ diff, tooltipId }: ResultReferenceDiffProps) =>
	diff ? (
		<div className="results-reference mb-2 font-normal">
			<span
				className={clsx('results-reference-diff font-bold', diff.tone)}
				data-sign={diff.tone ?? undefined}
				{...tooltipAnchorProps(tooltipId, diff.significance)}>
				{diff.text}
			</span>{' '}
			{i18n.t('sidebar.results.reference.vs_ref')}
		</div>
	) : null;
