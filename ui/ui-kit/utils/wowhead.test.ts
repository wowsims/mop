import { describe, expect, it } from 'vitest';

import { wowheadAnchorProps } from './wowhead';

describe('wowheadAnchorProps', () => {
	it('suppresses both the icon swap and the touch tooltip by default', () => {
		expect(wowheadAnchorProps()).toEqual({
			'data-whtticon': 'false',
			'data-disable-wowhead-touch-tooltip': 'true',
		});
	});

	// MultiIconPicker's trigger carries no href, so wowhead has no icon to swap in and the vanilla
	// build emits only the touch-tooltip attribute. Emitting both would be an attribute the parity
	// baseline does not have.
	it('omits the icon attribute for an element with no wowhead link', () => {
		const props = wowheadAnchorProps({ icon: false });
		expect(props).toEqual({ 'data-disable-wowhead-touch-tooltip': 'true' });
		expect('data-whtticon' in props).toBe(false);
	});
});
