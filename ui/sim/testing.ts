import { vi } from 'vitest';

import type { IndividualSimHost } from './sim_host';
import type { StoreSubscribe } from './state/subscriptions';

type Subscriptions = typeof import('./state/subscriptions');

export const noopSubscribe: StoreSubscribe = () => () => {};

/**
 * Every `subscribe*` export answered from one source; non-subscription exports stay real.
 *
 * `vi.mock` is hoisted above the imports, so the factory has to reach this module lazily:
 *
 * ```ts
 * vi.mock('@sim/state/subscriptions', async () => (await import('@sim/testing')).mockSubscriptions(source.subscribe));
 * ```
 */
export const mockSubscriptions = async (
	source: StoreSubscribe = noopSubscribe,
	overrides: Partial<Record<keyof Subscriptions, unknown>> = {},
): Promise<Subscriptions> => {
	const actual = await vi.importActual<Subscriptions>('./state/subscriptions');
	const answered = Object.keys(actual).map(name => [name, name.startsWith('subscribe') ? () => source : (actual as Record<string, unknown>)[name]]);
	return { ...Object.fromEntries(answered), ...overrides } as Subscriptions;
};

export type FakeHostParts = Partial<Record<keyof IndividualSimHost<any>, unknown>>;

export const fakeHost = (parts: FakeHostParts = {}): IndividualSimHost<any> =>
	({
		player: {},
		sim: {},
		disabled: false,
		config: { className: '', cssScheme: '' },
		individualConfig: {},
		...parts,
	}) as unknown as IndividualSimHost<any>;
