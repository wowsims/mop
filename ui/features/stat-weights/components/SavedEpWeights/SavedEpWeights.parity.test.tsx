// `SavedDataManager` is the oracle for this port: it is built beside the component from the same
// config and diffed against it. Two comparisons, because the browser gate only sees the first:
// `parity.mjs` serialises tag plus sorted class list, which must be identical, and the attribute
// deltas are asserted one by one so an unrecorded one fails as loudly as a missing one.
import { SimHostProvider } from '@sim/context/SimHostContext';
import { Stats } from '@sim/proto/stats';
import { Stat } from '@generated/proto/common';
import { SavedEPWeights } from '@generated/proto/ui';
import { act, render } from '@testing-library/react';
import { SavedDataManager } from '@ui-kit/saved_data_manager';
import { describe, expect, it, vi } from 'vitest';

import { SavedEpWeights } from './SavedEpWeights';

const source = vi.hoisted(() => ({ subscribe: () => () => undefined }));
vi.mock('@sim/state/subscriptions', () => ({ subscribePlayerField: () => source.subscribe }));

const STRINGS = vi.hoisted(
	() =>
		({
			'sidebar.buttons.stat_weights.modal.ep': 'EP',
			'sidebar.buttons.stat_weights.title': 'Stat Weights',
			'sidebar.buttons.stat_weights.saved_ep_weights.title': 'Saved EP weights',
			'common.name': 'Name',
		}) as Record<string, string>,
);
vi.mock('@i18n/config', () => ({ default: { t: (key: string) => STRINGS[key] ?? key } }));
vi.mock('../../../../tracking/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('tippy.js', () => ({ default: () => ({ destroy: () => undefined }) }));

const STORAGE_KEY = 'saved-ep-weights-parity';
const weights = (agility: number) => new Stats().withStat(Stat.StatAgility, agility);
const data = (agility: number) => SavedEPWeights.create({ epWeights: weights(agility).toProto() });

// What `SERIALIZE` in tools/react-migration/browser.mjs records: tag name and sorted class list.
const serialize = (root: Element, depth = 0): Array<string> => [
	`${'  '.repeat(depth)}${root.tagName.toLowerCase()}.${(root.getAttribute('class') ?? '').trim().split(/\s+/).filter(Boolean).sort().join('.')}`,
	...[...root.children].flatMap(child => serialize(child, depth + 1)),
];

const attributes = (root: Element): Array<Record<string, string>> => [
	Object.fromEntries([...root.attributes].filter(attribute => attribute.name !== 'class').map(attribute => [attribute.name, attribute.value])),
	...[...root.children].flatMap(attributes),
];

const build = async () => {
	const player: any = { getEpWeights: () => weights(4), setEpWeights: () => undefined };

	const vanillaParent = document.createElement('div');
	document.body.appendChild(vanillaParent);
	const manager = new SavedDataManager<any, SavedEPWeights>(vanillaParent, player, {
		label: 'EP',
		nameLabel: 'Stat Weights',
		header: { title: 'Saved EP weights' },
		storageKey: STORAGE_KEY,
		getData: () => data(4),
		setData: () => undefined,
		subscribe: source.subscribe as any,
		toJson: a => SavedEPWeights.toJson(a),
		fromJson: obj => SavedEPWeights.fromJson(obj),
	});
	manager.addSavedData({ name: 'Default', isPreset: true, data: data(3) });
	manager.addSavedData({ name: 'Mine', data: data(4) });

	window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ Mine: SavedEPWeights.toJson(data(4)) }));
	const host: any = {
		player,
		sim: { waitForInit: () => Promise.resolve() },
		individualConfig: { presets: { epWeights: [{ name: 'Default', epWeights: weights(3) }] } },
		getSavedEPWeightsStorageKey: () => STORAGE_KEY,
	};
	const reactParent = document.createElement('div');
	document.body.appendChild(reactParent);
	render(
		<SimHostProvider host={host}>
			<SavedEpWeights />
		</SimHostProvider>,
		{ container: reactParent },
	);
	await act(async () => {});

	return { vanilla: vanillaParent.firstElementChild!, react: reactParent.firstElementChild! };
};

describe('SavedEpWeights parity', () => {
	it('serialises to the same tree the vanilla manager does', async () => {
		const { vanilla, react } = await build();

		expect(serialize(react).join('\n')).toBe(serialize(vanilla).join('\n'));
	});

	it('adds exactly the attributes this port means to add, and no others', async () => {
		const { vanilla, react } = await build();
		const before = attributes(vanilla);
		const after = attributes(react);

		expect(after).toHaveLength(before.length);
		expect(before.flatMap((element, index) => Object.keys(element).filter(attribute => !(attribute in after[index])))).toEqual([]);

		const added = after
			.map((element, index) => Object.fromEntries(Object.entries(element).filter(([attribute, value]) => before[index][attribute] !== value)))
			.filter(element => Object.keys(element).length);

		expect(added).toEqual([
			// Base UI's `Button` writes `tabindex` on every one of the three buttons.
			{ tabindex: '0' },
			{ tabindex: '0' },
			// The delete button: an accessible name it never had, and react-tooltip's anchor in place
			// of tippy's binding. Its icon is `aria-hidden` because `Icon` hides an untitled glyph.
			{ 'aria-label': 'Delete saved EP', 'data-tooltip-id': expect.any(String), tabindex: '0' },
			{ 'aria-hidden': 'true' },
			// The label finally names the input.
			{ for: expect.any(String) },
			// `value` is an attribute on a controlled input; vanilla writes the same string as a property.
			{ id: expect.any(String), value: 'Mine' },
			{ tabindex: '0' },
		]);
	});
});
