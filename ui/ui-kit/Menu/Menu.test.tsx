import { fireEvent, render } from '@testing-library/react';
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
		expect(popup.className).toContain('bg-surface-raised');
		expect(popup.className).toContain('border-surface-border');
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
		expect(popup.className).toContain('bg-background');
		expect(popup.className).toContain('border-0');
	});

	it('forwards a testid onto the positioner', () => {
		const { getByTestId } = render(
			<Menu trigger="Open" surface="menu" triggerProps={{ 'data-testid': 'trigger' }} positionerProps={{ 'data-testid': 'positioner' }} open>
				<MenuItem layout="row">Item</MenuItem>
			</Menu>,
		);
		fireEvent.click(getByTestId('trigger'));
		expect(getByTestId('positioner').className).toContain('z-(--z-dropdown)');
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
		expect(getByText('Row item').className).toContain('flex');
	});

	it('applies the block layout classes', () => {
		const { getByText } = render(
			<Menu trigger="Open" surface="menu" open>
				<MenuItem layout="block">Block item</MenuItem>
			</Menu>,
		);
		fireEvent.click(getByText('Open'));
		expect(getByText('Block item').className).toContain('block');
	});
});
