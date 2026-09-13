import type { CombatLog } from '@sim/proto/combat_log';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LogRow } from './LogRow';

vi.mock('./LogLine', () => ({ LogLine: ({ log }: { log: CombatLog }) => <span>{log.raw}</span> }));

const log = { kind: 'plain', raw: 'a line', timestamp: 65.25 } as CombatLog;

const sizedRow = (scrollWidth: number, clientWidth: number) => {
	const proto = Object.getPrototypeOf(document.createElement('div'));
	vi.spyOn(proto, 'scrollWidth', 'get').mockReturnValue(scrollWidth);
	vi.spyOn(proto, 'clientWidth', 'get').mockReturnValue(clientWidth);
};

describe('LogRow', () => {
	it('lays the timestamp and the event out as the two columns the grid declares', () => {
		const { container } = render(<LogRow log={log} />);

		expect(container.querySelector('.log-runner-row')!.children).toHaveLength(2);
		expect(container.querySelector('.log-timestamp')!.textContent).toBe('01:05:250');
		expect(container.querySelector('.log-event')!.textContent).toBe('a line');
	});

	// This is the width-repair mechanism, so it has to fire.
	it('reports its own width once, when the line does not fit', () => {
		const onWidth = vi.fn();
		sizedRow(900, 400);
		render(<LogRow log={log} onWidth={onWidth} />);

		expect(onWidth).toHaveBeenCalledTimes(1);
		expect(onWidth).toHaveBeenCalledWith(900);
		vi.restoreAllMocks();
	});

	it('says nothing while the line already fits', () => {
		const onWidth = vi.fn();
		sizedRow(400, 400);
		render(<LogRow log={log} onWidth={onWidth} />);

		expect(onWidth).not.toHaveBeenCalled();
		vi.restoreAllMocks();
	});
});
