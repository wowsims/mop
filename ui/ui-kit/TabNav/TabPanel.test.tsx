import { Tabs } from '@base-ui/react/tabs';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TabPanel } from './TabPanel';

describe('TabPanel', () => {
	it('marks the active panel with tab-pane, active and show', () => {
		const { getByTestId } = render(
			<Tabs.Root defaultValue="a">
				<TabPanel value="a" className="my-pane">
					<div data-testid="a-content">A</div>
				</TabPanel>
			</Tabs.Root>,
		);
		const content = getByTestId('a-content');
		const pane = content.parentElement as HTMLElement;
		expect(pane.className).toContain('tab-pane');
		expect(pane.className).toContain('my-pane');
		expect(pane.className).toContain('active');
		expect(pane.className).toContain('show');
	});

	it('omits active and show on an inactive panel', () => {
		const { getByTestId } = render(
			<Tabs.Root defaultValue="a">
				<TabPanel value="a">
					<div data-testid="a-content">A</div>
				</TabPanel>
				<TabPanel value="b" keepMounted>
					<div data-testid="b-content">B</div>
				</TabPanel>
			</Tabs.Root>,
		);
		const pane = getByTestId('b-content').parentElement as HTMLElement;
		expect(pane.className).toContain('tab-pane');
		expect(pane.className).not.toContain('active');
		expect(pane.className).not.toContain('show');
	});
});
