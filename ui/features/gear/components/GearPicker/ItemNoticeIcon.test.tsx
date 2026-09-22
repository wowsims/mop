import { Spec } from '@generated/proto/common';
import { SimHostProvider } from '@sim/context/SimHostContext';
import { fakeHost } from '@sim/testing';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ITEM_NOTICES } from '../../item_notices';
import { ItemNoticeIcon } from './ItemNoticeIcon';

const SPEC_SPECIFIC_ITEM = 90101;
const NOTICED_ITEM = 90102;

const mount = (itemId: number, additionalNotice?: ReactNode, spec: Spec = Spec.SpecUnknown) => {
	const host = fakeHost({ player: { getSpec: () => spec } });
	return render(
		<SimHostProvider host={host}>
			<ItemNoticeIcon itemId={itemId} additionalNotice={additionalNotice} />
		</SimHostProvider>,
	);
};

const open = () => fireEvent.mouseEnter(screen.getByRole('button'));

describe('ItemNoticeIcon', () => {
	beforeEach(() => ITEM_NOTICES.set(NOTICED_ITEM, { [Spec.SpecUnknown]: <p>Item notice</p> }));

	afterEach(() => {
		ITEM_NOTICES.delete(SPEC_SPECIFIC_ITEM);
		ITEM_NOTICES.delete(NOTICED_ITEM);
	});

	it('renders nothing for an item with no notice', () => {
		const { container } = mount(1);
		expect(container.firstChild).toBeNull();
	});

	it('shows the item notice behind the warning icon', async () => {
		mount(NOTICED_ITEM);

		expect(screen.getByRole('button').className).toContain('fa-exclamation-triangle');
		open();
		expect(await screen.findByText('Item notice')).toBeTruthy();
	});

	it('shows an additional notice for an item that has none of its own', async () => {
		mount(1, <p>Please select a random suffix</p>);

		open();
		expect(await screen.findByText('Please select a random suffix')).toBeTruthy();
	});

	it('shows the item notice and the additional notice together, in that order', async () => {
		mount(NOTICED_ITEM, <p>Please select a random suffix</p>);

		open();
		const suffix = await screen.findByText('Please select a random suffix');
		const paragraphs = [...suffix.parentElement!.children].map(child => child.textContent);
		expect(paragraphs).toEqual(['Item notice', 'Please select a random suffix']);
	});

	it("prefers the player's spec notice over the generic one", async () => {
		ITEM_NOTICES.set(SPEC_SPECIFIC_ITEM, {
			[Spec.SpecUnknown]: <p>Generic notice</p>,
			[Spec.SpecArmsWarrior]: <p>Arms notice</p>,
		});
		mount(SPEC_SPECIFIC_ITEM, undefined, Spec.SpecArmsWarrior);

		open();
		expect(await screen.findByText('Arms notice')).toBeTruthy();
		expect(screen.queryByText('Generic notice')).toBeNull();
	});
});
