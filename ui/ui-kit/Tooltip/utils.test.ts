import { describe, expect, it } from 'vitest';

import { tooltipAnchorProps } from './utils';

describe('tooltipAnchorProps', () => {
	it('points the anchor at a tooltip id', () => {
		expect(tooltipAnchorProps('t1')).toEqual({ 'data-tooltip-id': 't1' });
	});

	// The icon-enum pickers put the text on each anchor so one Tooltip can serve every option.
	it('carries the text when one tooltip serves many anchors', () => {
		expect(tooltipAnchorProps('t1', 'No Armor')).toEqual({
			'data-tooltip-id': 't1',
			'data-tooltip-content': 'No Armor',
		});
	});

	// An anchor pointing at a tooltip with nothing to say still opens an empty one, so those pickers
	// drop the attribute entirely rather than passing an id with no content.
	it('emits nothing for a value with no tooltip', () => {
		expect(tooltipAnchorProps(undefined)).toEqual({});
		expect(tooltipAnchorProps(undefined, undefined)).toEqual({});
	});

	it('keeps an empty string as content, which is not the same as absent', () => {
		expect(tooltipAnchorProps('t1', '')).toEqual({ 'data-tooltip-id': 't1', 'data-tooltip-content': '' });
	});
});
