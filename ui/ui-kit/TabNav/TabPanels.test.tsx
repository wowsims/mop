import { Tabs } from '@base-ui/react/tabs';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TabPanel } from './TabPanel';
import { TabPanels } from './TabPanels';

describe('TabPanels', () => {
	it('stacks every panel in the same grid cell so a fade never shifts layout', () => {
		const { getByTestId } = render(
			<Tabs.Root defaultValue="a">
				<TabPanels>
					<TabPanel value="a">
						<div data-testid="a-content">A</div>
					</TabPanel>
					<TabPanel value="b" keepMounted>
						<div data-testid="b-content">B</div>
					</TabPanel>
				</TabPanels>
			</Tabs.Root>,
		);
		const container = getByTestId('a-content').parentElement!.parentElement as HTMLElement;
		expect(container.className).toContain('grid-cols-1');
		const panes = [...container.children];
		expect(panes).toHaveLength(2);
		panes.forEach(pane => {
			expect(pane.className).toContain('col-start-1');
			expect(pane.className).toContain('row-start-1');
		});
	});

	it('keeps a passed className alongside the grid classes', () => {
		const { container } = render(<TabPanels className="pt-6" data-testid="dr-tab-content" />);
		const root = container.firstElementChild as HTMLElement;
		expect(root.getAttribute('data-testid')).toBe('dr-tab-content');
		expect(root.className).toContain('pt-6');
		expect(root.className).toContain('grid-cols-1');
	});
});
