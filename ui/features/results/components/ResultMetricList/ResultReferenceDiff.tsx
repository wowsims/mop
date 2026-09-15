import i18n from '@i18n/config';
import { tooltipAnchorProps } from '@ui-kit/Tooltip';
import { toneTextClass } from '@ui-kit/utils/css';
import clsx from 'clsx';

import type { ReferenceDiff } from '../../model/reference_diffs';

export interface ResultReferenceDiffProps {
	diff?: ReferenceDiff;
	tooltipId?: string;
}

/** The delta against the saved reference run. Every layout renders the slot; only the sidebar, and only once a reference is set, fills it in. */
export const ResultReferenceDiff = ({ diff, tooltipId }: ResultReferenceDiffProps) =>
	diff ? (
		<div data-testid="results-reference" className="mb-2 font-normal">
			<span
				className={clsx('font-bold', toneTextClass(diff.tone))}
				data-testid="results-reference-diff"
				data-sign={diff.tone ?? undefined}
				{...tooltipAnchorProps(tooltipId, diff.significance)}>
				{diff.text}
			</span>{' '}
			{i18n.t('sidebar.results.reference.vs_ref')}
		</div>
	) : null;
