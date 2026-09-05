import { ActionId } from '@domain/proto_utils/action_id';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useActionId } from './action_id';

// A filled ActionId as fill() returns one: same id fields, plus name and iconUrl.
const filled = (actionId: ActionId, name: string, iconUrl: string) => Object.assign(Object.create(ActionId.prototype), actionId, { name, iconUrl }) as ActionId;

const deferFill = () => {
	const resolvers: Array<(value: ActionId) => void> = [];
	const spy = vi.spyOn(ActionId.prototype, 'fill').mockImplementation(function (this: ActionId) {
		return new Promise<ActionId>(resolve => resolvers.push(resolve));
	});
	return { spy, resolvers };
};

const Probe = ({ actionId }: { actionId: ActionId }) => {
	const { iconUrl, name, href, ready } = useActionId(actionId);
	return <a href={href} data-ready={String(ready)} data-icon={iconUrl} title={name} />;
};

const anchor = (container: HTMLElement) => container.querySelector('a')!;

afterEach(() => vi.restoreAllMocks());

describe('useActionId', () => {
	it('renders an already-filled id on the first pass', () => {
		const { spy } = deferFill();
		const seen: string[] = [];
		const Recorder = ({ actionId }: { actionId: ActionId }) => {
			const { iconUrl } = useActionId(actionId);
			seen.push(iconUrl);
			return null;
		};

		render(<Recorder actionId={filled(ActionId.fromSpellId(1), 'Fireball', 'fireball.jpg')} />);

		expect(seen[0]).toBe('fireball.jpg');
		expect(spy).not.toHaveBeenCalled();
	});

	it('fills an unfilled id and reports ready', async () => {
		const { resolvers } = deferFill();
		const actionId = ActionId.fromSpellId(2);
		const { container } = render(<Probe actionId={actionId} />);

		expect(anchor(container).dataset.icon).toBe('');
		expect(anchor(container).dataset.ready).toBe('false');

		await act(async () => resolvers[0](filled(actionId, 'Frostbolt', 'frostbolt.jpg')));

		expect(anchor(container).dataset.icon).toBe('frostbolt.jpg');
		expect(anchor(container).title).toBe('Frostbolt');
		expect(anchor(container).dataset.ready).toBe('true');
	});

	it('lets the current id win when an earlier fill resolves last', async () => {
		const { resolvers } = deferFill();
		const first = ActionId.fromSpellId(3);
		const second = ActionId.fromSpellId(4);
		const { container, rerender } = render(<Probe actionId={first} />);

		rerender(<Probe actionId={second} />);
		await act(async () => resolvers[1](filled(second, 'Second', 'second.jpg')));
		await act(async () => resolvers[0](filled(first, 'First', 'first.jpg')));

		expect(anchor(container).dataset.icon).toBe('second.jpg');
	});

	it('drops the previous icon in the render that changes the id', () => {
		deferFill();
		const { container, rerender } = render(<Probe actionId={filled(ActionId.fromSpellId(5), 'Old', 'old.jpg')} />);
		expect(anchor(container).dataset.icon).toBe('old.jpg');

		rerender(<Probe actionId={ActionId.fromSpellId(6)} />);

		expect(anchor(container).dataset.icon).toBe('');
	});

	it('knows the href without filling, and re-derives it when the reforge changes', () => {
		deferFill();
		const { container, rerender } = render(<Probe actionId={ActionId.fromItemId(7, 0, 0, 111)} />);
		const withReforge = anchor(container).href;
		expect(withReforge).toContain('forg=111');

		rerender(<Probe actionId={ActionId.fromItemId(7, 0, 0, 222)} />);

		expect(anchor(container).href).toContain('forg=222');
	});

	it('uses the spell url for a spell id', () => {
		deferFill();
		const { container } = render(<Probe actionId={ActionId.fromSpellId(8)} />);
		expect(anchor(container).href).toBe(ActionId.makeSpellUrl(8));
	});
});
