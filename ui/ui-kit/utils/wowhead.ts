/** Attributes wowhead's tooltip script reads. icon: false for an element with no href: there is no icon to suppress. */
export const wowheadAnchorProps = ({ icon = true }: { icon?: boolean } = {}) => ({
	...(icon ? { 'data-whtticon': 'false' } : {}),
	'data-disable-wowhead-touch-tooltip': 'true',
});
