import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TabPanelColumns } from './TabPanelColumns';

describe('TabPanelColumns', () => {
	it('renders Root as a div by default and keeps a passed className', () => {
		const { container } = render(<TabPanelColumns.Root className="tab-pane-content-container" />);
		const root = container.firstElementChild!;
		expect(root.tagName).toBe('DIV');
		expect(root.classList.contains('tab-pane-content-container')).toBe(true);
	});

	it('renders Root as a custom element via `as`', () => {
		const { container } = render(<TabPanelColumns.Root as="section" className="rotation-tab" />);
		expect(container.firstElementChild!.tagName).toBe('SECTION');
	});

	it('adds w-full to Root when fullWidth is set', () => {
		const { container } = render(<TabPanelColumns.Root fullWidth />);
		expect(container.firstElementChild!.classList.contains('w-full')).toBe(true);
	});

	it('uses a different gap for the apl variant', () => {
		const { container: withDefault } = render(<TabPanelColumns.Root />);
		const { container: withApl } = render(<TabPanelColumns.Root gap="apl" />);
		expect(withDefault.firstElementChild!.className).not.toBe(withApl.firstElementChild!.className);
	});

	it('renders Left with the default grid variant', () => {
		const { container } = render(<TabPanelColumns.Left className="gear-tab-left" />);
		const left = container.firstElementChild!;
		expect(left.classList.contains('gear-tab-left')).toBe(true);
		expect(left.classList.contains('ui-columns-left')).toBe(true);
	});

	it('renders Left with the stacked variant used by the rotation auto/simple panes', () => {
		const { container } = render(<TabPanelColumns.Left variant="stacked" />);
		const left = container.firstElementChild!;
		expect(left.classList.contains('ui-columns-left-stacked')).toBe(true);
		expect(left.classList.contains('ui-columns-left')).toBe(false);
	});

	it('renders Right and Col with their base layout classes', () => {
		const { container: rightContainer } = render(<TabPanelColumns.Right className="gear-tab-right" />);
		expect(rightContainer.firstElementChild!.classList.contains('gear-tab-right')).toBe(true);

		const { container: colContainer } = render(<TabPanelColumns.Col className="settings-left-col-1" />);
		expect(colContainer.firstElementChild!.classList.contains('settings-left-col-1')).toBe(true);
	});
});
