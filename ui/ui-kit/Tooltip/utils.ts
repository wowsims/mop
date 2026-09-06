/** content rides on the anchor when one Tooltip serves many; an undefined id emits nothing. */
export const tooltipAnchorProps = (id: string | undefined, content?: string) => ({
	...(id ? { 'data-tooltip-id': id } : {}),
	...(content === undefined ? {} : { 'data-tooltip-content': content }),
});
