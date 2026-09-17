import { Tabs } from '@base-ui/react/tabs';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TabNav } from './TabNav';

describe('TabNav', () => {
	it('renders nav-tabs list and link classes', () => {
		const { getByTestId, getByText } = render(
			<Tabs.Root defaultValue="a">
				<TabNav
					testId="tabs"
					tabs={[
						{ id: 'a', label: 'A' },
						{ id: 'b', label: 'B' },
					]}
				/>
			</Tabs.Root>,
		);
		const list = getByTestId('tabs');
		expect(list.className.split(' ')).toEqual(expect.arrayContaining(['ui-tabs']));
		const tabA = getByText('A');
		expect(tabA.className.split(' ')).toEqual(expect.arrayContaining(['ui-tab']));
		expect(tabA.hasAttribute('data-active')).toBe(true);
		const tabB = getByText('B');
		expect(tabB.hasAttribute('data-active')).toBe(false);
	});

	it('renders the sim variant with its styling class and per-tab testid', () => {
		const { getByTestId } = render(
			<Tabs.Root defaultValue="a">
				<TabNav variant="sim" testId="sim-tabs" tabs={[{ id: 'a', label: 'A' }]} />
			</Tabs.Root>,
		);
		expect(getByTestId('sim-tabs').className).toContain('ui-tabs-sim');
		expect(getByTestId('a').classList.contains('a')).toBe(true);
		expect(getByTestId('a').classList.contains('ui-tab')).toBe(true);
	});

	it('carries per-tab id, aria-controls and data-label', () => {
		const { getByText } = render(
			<Tabs.Root defaultValue="a">
				<TabNav tabs={[{ id: 'a', label: 'A', tabId: 'a-nav', ariaControls: 'a-pane', dataLabel: 'A' }]} />
			</Tabs.Root>,
		);
		const tab = getByText('A');
		expect(tab.getAttribute('id')).toBe('a-nav');
		expect(tab.getAttribute('aria-controls')).toBe('a-pane');
		expect(tab.getAttribute('data-label')).toBe('A');
	});
});
