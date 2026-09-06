/**
 * Opts an element into the `Tooltip` with this id.
 *
 * `content` is for the case where one `Tooltip` serves many anchors and the text rides on each
 * anchor rather than on the tooltip — the icon-enum pickers do this, so a popup does not need one
 * `Tooltip` element per option. Omit it when the `Tooltip` carries its own `content`, which is every
 * other call site.
 *
 * `id` is nullable because those same pickers drop the attribute entirely when a value has no
 * tooltip text: an anchor pointing at a tooltip with nothing to say still opens an empty one.
 */
export const tooltipAnchorProps = (id: string | undefined, content?: string) => ({
	...(id ? { 'data-tooltip-id': id } : {}),
	...(content === undefined ? {} : { 'data-tooltip-content': content }),
});
