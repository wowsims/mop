import type { Social } from '@domain/constants/other';
import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import { useId } from 'react';

export interface SocialLinkProps {
	social: Social;
}

/**
 * One social link and its tooltip. The anchor is all it renders — what wraps it is the caller's
 * business, which is the difference between the two places these appear: the toolbar puts each in a
 * `div.sim-toolbar-item`, the sidebar puts them straight into `.sim-sidebar-socials`.
 *
 * The tooltip text is also the accessible name; the glyph is a private-use codepoint and announces
 * nothing. Patreon's visible " Patreon" is inside its tooltip string, so the name still contains the
 * label.
 */
export const SocialLink = ({ social }: SocialLinkProps) => {
	const id = useId();
	const tooltip = i18n.t(social.tooltip);
	return (
		<>
			<Button as="a" variant="unstyled" href={social.href} target="_blank" className={social.className} aria-label={tooltip} {...tooltipAnchorProps(id)}>
				<Icon name={social.icon} style="brands" size="lg" />
				{'label' in social && social.label}
			</Button>
			{/* tippy's default placement, which the socials took and the rest of the toolbar did not. */}
			<Tooltip id={id} content={tooltip} />
		</>
	);
};
