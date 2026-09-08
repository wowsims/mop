import type { Entity } from '@sim/proto/combat_log';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EntityLabel } from './EntityLabel';

const entity = (extra: Partial<Entity>) => ({ name: 'Warrior', ownerName: '', index: 0, isTarget: false, isPet: false, ...extra }) as Entity;

describe('EntityLabel', () => {
	it('numbers a player from one and paints it with the player colour', () => {
		const { container } = render(<EntityLabel entity={entity({ name: 'Warrior', index: 2 })} />);

		expect(container.textContent).toBe('[Warrior 3]');
		expect(container.querySelector('span')!.className).toBe('text-primary');
	});

	it('names a target by number rather than by name, in the danger colour', () => {
		const { container } = render(<EntityLabel entity={entity({ name: 'Boss', index: 0, isTarget: true })} />);

		expect(container.textContent).toBe('[Target 1]');
		expect(container.querySelector('span')!.className).toBe('text-danger');
	});

	// A pet's bracket carries its owner, and the pet's own name sits outside it unstyled.
	it('brackets a pet under its owner and trails its own name', () => {
		const { container } = render(<EntityLabel entity={entity({ name: 'Greater Fire Elemental', ownerName: 'Shaman', index: 1, isPet: true })} />);

		expect(container.textContent).toBe('[Shaman 2] - Greater Fire Elemental');
		expect(container.querySelector('span')!.textContent).toBe('[Shaman 2]');
	});
});
