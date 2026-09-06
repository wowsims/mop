/**
 * The attributes wowhead's tooltip script reads off an anchor, in one place instead of at every
 * anchor that carries a wowhead link.
 *
 * `whtticon="false"` suppresses the icon wowhead would otherwise swap in, and
 * `disable-wowhead-touch-tooltip` suppresses its touch tooltip. They are separable: an element with
 * no `href` has no icon for wowhead to replace, so passing `icon: false` omits the first — which is
 * what `MultiIconPicker`'s trigger does, and the vanilla build does the same. Emitting both there
 * would be an attribute the baseline does not have.
 */
export const wowheadAnchorProps = ({ icon = true }: { icon?: boolean } = {}) => ({
	...(icon ? { 'data-whtticon': 'false' } : {}),
	'data-disable-wowhead-touch-tooltip': 'true',
});
