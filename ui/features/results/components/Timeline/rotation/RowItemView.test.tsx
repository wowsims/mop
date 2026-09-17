import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { AuraItem, CastItem, ResourceItem, RowItem, TickItem } from '../../../model/timeline/rotation';
import { RowItemView } from './RowItemView';

const mount = (item: RowItem, index = 3, iconUrl = 'bolt.png', cssName = 'mana') =>
	render(<RowItemView item={item} index={index} iconUrl={iconUrl} cssName={cssName} />).container.firstElementChild as HTMLElement;

const vars = (element: HTMLElement) => ({ t: element.style.getPropertyValue('--t'), dur: element.style.getPropertyValue('--dur') });

describe('RowItemView', () => {
	it('draws a cast as a bar carrying its outcome, its span and the row’s icon', () => {
		const element = mount({ kind: 'cast', start: 2, end: 3.5, outcome: 'crit', cancelled: false, travelStart: null, travelDuration: null } as CastItem);
		expect(element.dataset.outcome).toBe('crit');
		expect(vars(element)).toEqual({ t: '2', dur: '1.5' });
		expect(element.dataset.itemIndex).toBe('3');
		expect(element.querySelector<HTMLElement>('[data-testid="rotation-item-icon"]')!.style.backgroundImage).toContain('bolt.png');
		expect(element.querySelector<HTMLElement>('[data-testid="rotation-item-travel"]')!.hidden).toBe(true);
	});

	it('marks a cancelled cast and shows the travel leg when there is one', () => {
		const element = mount({ kind: 'cast', start: 0, end: 1, outcome: 'none', cancelled: true, travelStart: 1, travelDuration: 0.4 } as CastItem);
		expect(element.dataset.outcome).toBe('cancelled');
		const travel = element.querySelector<HTMLElement>('[data-testid="rotation-item-travel"]')!;
		expect(travel.hidden).toBe(false);
		expect(vars(travel)).toEqual({ t: '1', dur: '0.4' });
	});

	it('draws a tick as a mark at its own time, with no span', () => {
		const element = mount({ kind: 'tick', start: 7, end: 7 } as TickItem);
		expect(element.dataset.testid).toBe('rotation-item-tick');
		expect(vars(element)).toEqual({ t: '7', dur: '' });
	});

	it('draws an aura as a span, with one block per stack segment', () => {
		const element = mount({
			kind: 'aura',
			start: 1,
			end: 5,
			sharesRowWithCast: true,
			stacks: [
				{ offset: 0, duration: 2, stacks: 3 },
				{ offset: 2, duration: 2, stacks: 5 },
			],
		} as AuraItem);
		expect(element.hasAttribute('data-shares-row')).toBe(true);
		const stacks = [...element.querySelectorAll<HTMLElement>('[data-testid="rotation-item-stacks"]')];
		expect(stacks.map(stack => stack.textContent)).toEqual(['3', '5']);
		expect(vars(stacks[1])).toEqual({ t: '2', dur: '2' });
	});

	it('draws a resource block in the row’s colour, filling it only when the row asks for a fill', () => {
		const numeric = mount({ kind: 'resource', start: 0, end: 2, display: 'number', fillPercent: 0, text: '42' } as ResourceItem);
		expect(numeric.dataset.testid).toBe('series-color');
		expect(numeric.classList.contains('mana')).toBe(true);
		expect(numeric.querySelector<HTMLElement>('[data-testid="rotation-item-resource-fill"]')!.hidden).toBe(true);
		expect(numeric.querySelector('[data-testid="rotation-item-resource-text"]')!.textContent).toBe('42');

		const filled = mount({ kind: 'resource', start: 0, end: 2, display: 'fill', fillPercent: 65, text: '65%' } as ResourceItem);
		const fill = filled.querySelector<HTMLElement>('[data-testid="rotation-item-resource-fill"]')!;
		expect(fill.hidden).toBe(false);
		expect(fill.style.getPropertyValue('--fill')).toBe('65');
	});
});
