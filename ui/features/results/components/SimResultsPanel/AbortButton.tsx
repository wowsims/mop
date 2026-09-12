import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import { useState } from 'react';
import { flushSync } from 'react-dom';

export interface AbortButtonProps {
	onAbort: (event: MouseEvent) => void;
}

export const AbortButton = ({ onAbort }: AbortButtonProps) => {
	const [stopping, setStopping] = useState(false);
	return (
		<Button
			variant="unstyled"
			className="sim-abort-button"
			disabled={stopping}
			onClick={event => {
				// Synchronous: the run action reads the button back in the click's own task.
				flushSync(() => setStopping(true));
				onAbort(event.nativeEvent);
			}}>
			<Icon name="times" style="base" size="lg" className="me-1" />
			{stopping ? i18n.t('sidebar.results.stopping') : i18n.t('sidebar.results.stop')}
		</Button>
	);
};
