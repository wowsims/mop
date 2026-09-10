import { LogLevel } from '@generated/proto/common';
import { SimHostProvider } from '@sim/context/SimHostContext';
import { ActionId } from '@sim/proto/action_id';
import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ListItemHeader } from './ListItemHeader';
import { uuidValidations } from './utils';

const source = vi.hoisted(() => {
	const listeners = new Set<() => void>();
	return {
		listeners,
		subscribe: (onChange: () => void) => {
			listeners.add(onChange);
			return () => listeners.delete(onChange);
		},
		notify: () => listeners.forEach(listener => listener()),
	};
});

vi.mock('@sim/state/subscriptions', () => ({
	subscribePlayerField: () => source.subscribe,
}));
vi.mock('@i18n/config', () => ({ default: { t: (key: string) => key } }));
vi.mock('@sim/proto/action_id', () => ({ ActionId: { replaceAllInString: vi.fn(async (str: string) => str) } }));

interface Row {
	hide: boolean;
}

const makePlayer = (touchRotation: () => void = () => {}) => ({
	touchRotation,
	getCurrentStats: () => ({ rotationStats: undefined }),
});

const mount = (item: Row, getValidations: (player: any) => Array<any>, player = makePlayer()) => {
	const rendered = render(
		<SimHostProvider host={{ player } as never}>
			<ListItemHeader player={player as any} getItem={() => item} getValidations={getValidations} />
		</SimHostProvider>,
	);
	return { ...rendered, player };
};

describe('ListItemHeader', () => {
	it('renders the validations button before the hide picker', () => {
		const { container } = mount({ hide: false }, () => []);

		const nodes = Array.from(container.querySelectorAll('.apl-validations, .hide-picker-root'));
		expect(nodes.length).toBe(2);
		expect(nodes[0].classList.contains('apl-validations')).toBe(true);
		expect(nodes[1].classList.contains('hide-picker-root')).toBe(true);
	});

	describe('hide picker', () => {
		it('shows fa-eye when hide is false and fa-eye-slash when hide is true', () => {
			const notHidden = mount({ hide: false }, () => []);
			const hidden = mount({ hide: true }, () => []);

			const notHiddenIcon = notHidden.container.querySelector('.hide-picker-button i')!;
			const hiddenIcon = hidden.container.querySelector('.hide-picker-button i')!;

			expect(notHiddenIcon.classList.contains('fa-eye')).toBe(true);
			expect(notHiddenIcon.classList.contains('fa-eye-slash')).toBe(false);
			expect(hiddenIcon.classList.contains('fa-eye-slash')).toBe(true);
		});

		it('writes hide and calls player.touchRotation() on click', () => {
			const touchRotation = vi.fn();
			const player = makePlayer(touchRotation);
			const item: Row = { hide: false };
			const { container } = mount(item, () => [], player);

			act(() => {
				fireEvent.click(container.querySelector('.hide-picker-button') as HTMLButtonElement);
			});

			expect(item.hide).toBe(true);
			expect(touchRotation).toHaveBeenCalledTimes(1);
		});
	});

	describe('validations', () => {
		const validation = (logLevel: LogLevel, validation: string) => ({ logLevel, validation });

		it('stays hidden while there are no validations', () => {
			const { container } = mount({ hide: false }, () => []);

			const button = container.querySelector('.apl-validations') as HTMLElement;
			expect(button.style.display).toBe('none');
			expect(button.classList.contains('apl-validation-warning')).toBe(false);
			expect(button.classList.contains('apl-validation-error')).toBe(false);
			expect(button.classList.contains('apl-validation-information')).toBe(false);
		});

		it('becomes visible with the information class and icon for an information-only validation', async () => {
			source.listeners.clear();
			const { container } = mount({ hide: false }, () => [validation(LogLevel.Information, 'fyi')]);

			await act(async () => {
				source.notify();
			});

			const button = container.querySelector('.apl-validations') as HTMLElement;
			expect(button.style.display).not.toBe('none');
			expect(button.classList.contains('apl-validation-information')).toBe(true);
			expect(button.querySelector('i')?.classList.contains('fa-info-circle')).toBe(true);
		});

		it('uses the highest level in a mixed set of validations', async () => {
			source.listeners.clear();
			const mixed = [validation(LogLevel.Information, 'fyi'), validation(LogLevel.Warning, 'careful'), validation(LogLevel.Error, 'broken')];
			const { container } = mount({ hide: false }, () => mixed);

			await act(async () => {
				source.notify();
			});

			const button = container.querySelector('.apl-validations') as HTMLElement;
			expect(button.classList.contains('apl-validation-error')).toBe(true);
			expect(button.classList.contains('apl-validation-warning')).toBe(false);
			expect(button.classList.contains('apl-validation-information')).toBe(false);
			expect(button.querySelector('i')?.classList.contains('fa-exclamation-triangle')).toBe(true);
		});

		it('uses the warning class and icon when the highest level is a warning', async () => {
			source.listeners.clear();
			const mixed = [validation(LogLevel.Information, 'fyi'), validation(LogLevel.Warning, 'careful')];
			const { container } = mount({ hide: false }, () => mixed);

			await act(async () => {
				source.notify();
			});

			const button = container.querySelector('.apl-validations') as HTMLElement;
			expect(button.classList.contains('apl-validation-warning')).toBe(true);
			expect(button.querySelector('i')?.classList.contains('fa-exclamation-triangle')).toBe(true);
		});

		it('keeps its formatted list when a notification leaves the validations unchanged', async () => {
			source.listeners.clear();
			let current = [validation(LogLevel.Warning, 'careful')];
			const { container } = mount({ hide: false }, () => current.map(entry => ({ ...entry })));
			await act(async () => {
				source.notify();
			});
			const format = vi.mocked(ActionId.replaceAllInString);
			const formatted = format.mock.calls.length;

			await act(async () => {
				source.notify();
			});
			expect(format.mock.calls.length).toBe(formatted);

			current = [validation(LogLevel.Error, 'broken')];
			await act(async () => {
				source.notify();
			});
			expect(format.mock.calls.length).toBe(formatted + 1);
			expect((container.querySelector('.apl-validations') as HTMLElement).classList.contains('apl-validation-error')).toBe(true);
		});

		// The sim formats rotation-supplied names into its messages ("Group reference '%s' not found"),
		// and rotations are shared and imported, so a message is attacker-controlled text.
		it('renders a message as text, so markup in a rotation-supplied name cannot execute', async () => {
			source.listeners.clear();
			const hostile = `Group reference '<img src=x onerror=alert(1)>' not found`;
			const { container } = mount({ hide: false }, () => [validation(LogLevel.Error, hostile)]);

			await act(async () => {
				source.notify();
			});
			await act(async () => {
				fireEvent.mouseEnter(container.querySelector('.apl-validations') as HTMLElement);
			});

			const tooltip = document.querySelector('.sim-tooltip') as HTMLElement;
			expect(tooltip.querySelector('img')).toBeNull();
			expect(tooltip.querySelector('li')!.textContent).toBe(hostile);
		});
	});
});

describe('uuidValidations', () => {
	const makeStatsPlayer = (uuidValidationsList: Array<{ uuid: { value: string }; validations: Array<any> }>) => ({
		getCurrentStats: () => ({ rotationStats: { uuidValidations: uuidValidationsList } }),
	});

	it('returns [] for an undefined uuid', () => {
		const player = makeStatsPlayer([{ uuid: { value: 'a' }, validations: [{ logLevel: LogLevel.Warning, validation: 'x' }] }]);
		expect(uuidValidations(player as any, undefined)).toEqual([]);
	});

	it('returns [] for a uuid with no match', () => {
		const player = makeStatsPlayer([{ uuid: { value: 'a' }, validations: [{ logLevel: LogLevel.Warning, validation: 'x' }] }]);
		expect(uuidValidations(player as any, 'missing')).toEqual([]);
	});

	it('returns the matching entry’s validations', () => {
		const target = [{ logLevel: LogLevel.Error, validation: 'boom' }];
		const player = makeStatsPlayer([
			{ uuid: { value: 'a' }, validations: [{ logLevel: LogLevel.Warning, validation: 'x' }] },
			{ uuid: { value: 'b' }, validations: target },
		]);
		expect(uuidValidations(player as any, 'b')).toEqual(target);
	});
});
