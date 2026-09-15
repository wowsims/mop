import type { WarningsRegistry } from '@features/results/model/warnings';
import i18n from '@i18n/config';
import { useReadyStoreSubscribe } from '@sim/hooks/useReadyStoreSubscribe';
import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
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
		<div className="text-center" data-testid="warning-zone">
			{contents.length > 0 && (
				<div data-testid="sim-toolbar-item">
					<Button
						variant="unstyled"
						className="text-link-warning focus-visible:focus-ring"
						data-testid="warning-trigger"
						aria-label={i18n.t('sidebar.warnings.label')}
						{...tooltipAnchorProps(id)}>
						<Icon name="exclamation-triangle" size="3x" />
					</Button>
					<Tooltip
						id={id}
						width="w-full"
						place="bottom"
						content={
							<ul className="mb-0 ps-3 text-start">
								{contents.map((warning, index) => (
									<li key={`${index}:${warning}`}>{warning}</li>
								))}
							</ul>
						}
					/>
				</div>
			)}
		</div>
	);
};
