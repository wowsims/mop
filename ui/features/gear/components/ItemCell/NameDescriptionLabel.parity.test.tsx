import { createNameDescriptionLabel } from '@features/gear/view/gear_elements';
import { render } from '@testing-library/react';
import type { VanillaPicker } from '@ui-kit/testing/PickerOracle';
import { mountBoth } from '@ui-kit/testing/PickerOracle';
import type { ClassValue } from 'clsx';
import { describe, expect, it } from 'vitest';

import { NameDescriptionLabel } from './NameDescriptionLabel';

interface ModObject {
	nameDescription: string;
}

// `createNameDescriptionLabel` returns the element rather than mounting it, and takes no config, so
// the adapter appends it and the whole axis lives on the mod object.
class VanillaAdapter implements VanillaPicker {
	readonly rootElem: HTMLElement;

	constructor(parent: HTMLElement, modObject: ModObject) {
		this.rootElem = createNameDescriptionLabel(modObject.nameDescription) as unknown as HTMLElement;
		parent.appendChild(this.rootElem);
	}

	dispose() {
		this.rootElem.remove();
	}
}

const ReactAdapter = ({ modObject }: { modObject: ModObject }) => <NameDescriptionLabel nameDescription={modObject.nameDescription} />;

const both = (nameDescription: string) =>
	mountBoth({ Vanilla: VanillaAdapter, React: ReactAdapter, config: undefined, makeModObject: () => ({ nameDescription }) });

describe('NameDescriptionLabel matches the vanilla name description label', () => {
	for (const nameDescription of ['Heroic', 'Raid Finder', 'Heroic Thunderforged', '']) {
		it(`renders "${nameDescription}" the same`, async () => {
			const pair = await both(nameDescription);
			expect(pair.diff(), pair.allDiffs().join('\n')).toEqual([]);
			pair.dispose();
		});
	}

	// `className` is the port's own axis — the vanilla helper has no parameter for it.
	it('appends className after the base class', () => {
		const className: ClassValue = ['extra-a', { 'extra-b': true, 'extra-c': false }];
		const { container } = render(<NameDescriptionLabel nameDescription="Heroic" className={className} />);
		expect(container.firstElementChild!.getAttribute('class')).toBe('heroic-label extra-a extra-b');
	});
});
