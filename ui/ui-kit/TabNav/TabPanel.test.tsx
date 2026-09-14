import { Tabs } from '@base-ui/react/tabs';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TabPanel } from './TabPanel';

describe('TabPanel', () => {
	it('marks the active panel as visible via the hidden and transition-style attributes', () => {
		const { getByTestId } = render(
			<Tabs.Root defaultValue="a">
				<TabPanel value="a" className="my-pane">
					<div data-testid="a-content">A</div>
				</TabPanel>
			</Tabs.Root>,
		);
		const content = getByTestId('a-content');
		const pane = content.parentElement as HTMLElement;
		expect(pane.getAttribute('data-testid')).toBe('tab-pane');
		expect(pane.className).toContain('my-pane');
		expect(pane.hasAttribute('hidden')).toBe(false);
		expect(pane.hasAttribute('data-starting-style')).toBe(false);
		expect(pane.hasAttribute('data-ending-style')).toBe(false);
	});

	it('marks an inactive panel hidden', () => {
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
		expect(pane.getAttribute('data-testid')).toBe('tab-pane');
		expect(pane.hasAttribute('hidden')).toBe(true);
	});
});
