import type { WarningsRegistry } from '@features/results/model/warnings';
import i18n from '@i18n/config';
import { useReadyStoreSubscribe } from '@sim/hooks/useReadyStoreSubscribe';
import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { useId } from 'react';

export interface SimWarningsProps {
	warnings: WarningsRegistry;
	/** Every warning judges the player's gear and talents, which are empty until the sim has loaded. */
	ready: boolean;
}

/**
 * `getContents()` builds a fresh array per call, so it is read through the snapshot cache;
 * `useSyncExternalStore` would read the new identity as a change and loop.
 */
export const SimWarnings = ({ warnings, ready }: SimWarningsProps) => {
	const id = useId();
	const contents = useReadyStoreSubscribe(warnings.subscribe, warnings.getContents, ready) ?? [];
	return (
		<div className="warning-zone text-center">
			<div className={clsx('sim-toolbar-item', !contents.length && 'hide')}>
				<Button variant="unstyled" className="warning link-warning" aria-label={i18n.t('sidebar.warnings.label')} {...tooltipAnchorProps(id)}>
					<Icon name="exclamation-triangle" size="3x" />
				</Button>
				<Tooltip
					id={id}
					place="bottom"
					content={
						<ul className="text-start ps-3 mb-0">
							{contents.map((warning, index) => (
								<li key={`${index}:${warning}`}>{warning}</li>
							))}
						</ul>
					}
				/>
			</div>
		</div>
	);
};
