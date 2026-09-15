import type { CombatLog } from '@sim/proto/combat_log';
import { formattedTimestamp } from '@sim/proto/combat_log';
import { useCallback } from 'react';

import { LogLine } from './LogLine';

export interface LogRowProps {
	log: CombatLog;
	/**
	 * How wide this line actually is, reported once as the row mounts. Lines never wrap, so a row
	 * whose content scrolls out of its own box is the list being too narrow; `@tanstack/react-virtual`
	 * has no built-in hook for that. Reporting the width rather than the overflow keeps the report
	 * idempotent: several rows in one window each say what they need and the widest wins, where
	 * summing overflows would not.
	 */
	onWidth?: (width: number) => void;
}

export const LogRow = ({ log, onWidth }: LogRowProps) => {
	const measure = useCallback(
		(element: HTMLDivElement | null) => {
			if (!element || !onWidth) return;
			if (element.scrollWidth > element.clientWidth) onWidth(element.scrollWidth);
		},
		[onWidth],
	);

	return (
		<div ref={measure} data-testid="log-runner-row" className="ui-log-row">
			<div data-testid="log-timestamp" className="p-2 text-right whitespace-nowrap tabular-nums">
				{formattedTimestamp(log)}
			</div>
			<div data-testid="log-event" className="p-2 whitespace-nowrap">
				<LogLine log={log} />
			</div>
		</div>
	);
};
