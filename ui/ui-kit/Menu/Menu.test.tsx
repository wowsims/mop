import { act, fireEvent, render, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Menu } from './Menu';
import { MenuItem } from './MenuItem';

describe('Menu', () => {
	it('renders the menu surface classes when open', () => {
		const { getByTestId, getByText } = render(
			<Menu trigger="Open" surface="menu" triggerProps={{ 'data-testid': 'trigger' }} popupProps={{ 'data-testid': 'popup' }} open>
				<MenuItem layout="row">Item</MenuItem>
			</Menu>,
		);
		fireEvent.click(getByTestId('trigger'));
		const popup = getByTestId('popup');
		expect(popup.className).toContain('ui-menu');
		expect(getByText('Item')).toBeTruthy();
	});

	it('renders the plain surface classes when open', () => {
		const { getByTestId } = render(
			<Menu trigger="Open" surface="plain" triggerProps={{ 'data-testid': 'trigger' }} popupProps={{ 'data-testid': 'popup' }} open>
				<MenuItem layout="block">Item</MenuItem>
			</Menu>,
		);
		fireEvent.click(getByTestId('trigger'));
		const popup = getByTestId('popup');
		expect(popup.className).toContain('ui-menu-plain');
	});

	it('forwards a testid onto the positioner', () => {
		const { getByTestId } = render(
			<Menu trigger="Open" surface="menu" triggerProps={{ 'data-testid': 'trigger' }} positionerProps={{ 'data-testid': 'positioner' }} open>
				<MenuItem layout="row">Item</MenuItem>
			</Menu>,
		);
		fireEvent.click(getByTestId('trigger'));
		expect(getByTestId('positioner').className).toContain('ui-menu-positioner');
	});
});

describe('MenuItem', () => {
	it('applies the row layout classes', () => {
		const { getByText } = render(
			<Menu trigger="Open" surface="menu" open>
				<MenuItem layout="row">Row item</MenuItem>
			</Menu>,
		);
		fireEvent.click(getByText('Open'));
		expect(getByText('Row item').className).toContain('ui-menu-item-row');
	});

	it('applies the block layout classes', () => {
		const { getByText } = render(
			<Menu trigger="Open" surface="menu" open>
				<MenuItem layout="block">Block item</MenuItem>
			</Menu>,
		);
		fireEvent.click(getByText('Open'));
		expect(getByText('Block item').className).toContain('ui-menu-item');
	});
});

describe('Menu submenu', () => {
	const mountSubmenu = () =>
		render(
			<Menu trigger="Open" surface="menu" triggerProps={{ 'data-testid': 'trigger' }} open>
				<Menu
					submenu
					surface="menu"
					trigger={<span>Sub</span>}
					triggerRender={<button type="button" />}
					triggerProps={{ className: 'ui-submenu-trigger-probe', 'data-testid': 'submenu-trigger' }}
					popupProps={{ 'data-testid': 'submenu-popup' }}>
					<MenuItem layout="row">Nested item</MenuItem>
				</Menu>
			</Menu>,
		);

	it('renders the trigger element the caller asked for, with its props', () => {
		const { getByTestId } = mountSubmenu();

		const trigger = getByTestId('submenu-trigger');
		expect(trigger.tagName).toBe('BUTTON');
		expect(trigger.getAttribute('role')).toBe('menuitem');
		expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
		expect(trigger.className).toContain('ui-submenu-trigger-probe');
		expect(trigger.textContent).toBe('Sub');
	});

	it('opens the submenu popup from that trigger', () => {
		const { getByTestId, queryByTestId } = mountSubmenu();
		expect(queryByTestId('submenu-popup')).toBeNull();

		act(() => void fireEvent.click(getByTestId('submenu-trigger')));

		expect(within(getByTestId('submenu-popup')).getByText('Nested item')).toBeTruthy();
	});
});
