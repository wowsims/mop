import { ResourceType } from '@generated/proto/spell';
import type { ResourceGroupLog } from '@sim/proto/combat_log';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ResourceTooltip } from './ResourceTooltip';

const log = (resourceType: ResourceType, over: Partial<ResourceGroupLog> = {}) =>
	({
		resourceType,
		timestamp: 12.345,
		valueBefore: 800,
		valueAfter: 500,
		logs: [
			{ valueBefore: 800, valueAfter: 500, actionId: { name: 'Fireball', iconUrl: 'fireball.png' } },
			{ valueBefore: 500, valueAfter: 700, actionId: { name: 'Evocation', iconUrl: '' } },
		],
		activeAuras: [{ actionId: { name: 'Arcane Power', iconUrl: 'ap.png' } }],
		...over,
	}) as unknown as ResourceGroupLog;

const mount = (resourceType: ResourceType, maxValue = 1000, includeAuras = false) =>
	render(<ResourceTooltip log={log(resourceType)} maxValue={maxValue} includeAuras={includeAuras} />).container.firstElementChild as HTMLElement;

describe('ResourceTooltip', () => {
	it('classes itself by the resource’s own name, which is what colours its numbers', () => {
		expect(mount(ResourceType.ResourceTypeMana).className).toBe('timeline-tooltip mana');
		expect(mount(ResourceType.ResourceTypeComboPoints).className).toBe('timeline-tooltip combo-points');
	});

	it('shows mana as a share of the maximum and everything else as a plain number', () => {
		const mana = mount(ResourceType.ResourceTypeMana).querySelectorAll('.timeline-tooltip-body-row');
		expect(mana[0].textContent).toContain('800.0 (80%)');
		expect(mana[1].textContent).toContain('500.0 (50%)');

		const rage = mount(ResourceType.ResourceTypeRage).querySelectorAll('.timeline-tooltip-body-row');
		expect(rage[0].textContent).toContain('800.0');
		expect(rage[0].textContent).not.toContain('%');
	});

	it('signs each event by its direction', () => {
		const events = [...mount(ResourceType.ResourceTypeRage).querySelectorAll('.timeline-mana-events li')];
		expect(events.map(event => event.querySelector('.series-color')!.textContent)).toEqual(['-300.0', '+200.0']);
	});

	it('shows an icon only for an event that has one, and always names the action', () => {
		const events = [...mount(ResourceType.ResourceTypeRage).querySelectorAll('.timeline-mana-events li')];
		expect(events[0].querySelector('img')!.getAttribute('src')).toBe('fireball.png');
		expect(events[1].querySelector('img')).toBeNull();
		expect(events[1].textContent).toContain('Evocation');
	});

	it('lists the active auras only when asked, which the rotation’s own blocks are not', () => {
		expect(mount(ResourceType.ResourceTypeRage, 1000, false).querySelector('.timeline-tooltip-auras')).toBeNull();
		const auras = mount(ResourceType.ResourceTypeRage, 1000, true).querySelector('.timeline-tooltip-auras')!;
		expect(auras.textContent).toContain('Arcane Power');
	});
});
