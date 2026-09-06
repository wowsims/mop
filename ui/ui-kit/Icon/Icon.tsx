import clsx from 'clsx';
import type { HTMLAttributes } from 'react';

import { ICON_ALIASES, ICON_STYLE_CLASS, type IconAlias, type IconName, type IconSize, type IconStyle } from './types';

// `style` is the FontAwesome style here, not a CSS object, so it shadows the DOM prop.
export interface IconProps extends Omit<HTMLAttributes<HTMLElement>, 'style'> {
	name: IconName | IconAlias;
	style?: IconStyle;
	size?: IconSize;
	spin?: boolean;
	className?: string;
	title?: string;
}

const resolve = (name: IconName | IconAlias): IconName => (name in ICON_ALIASES ? ICON_ALIASES[name as IconAlias] : (name as IconName));

// The rest props matter: an icon is an anchor for its own tooltip at several sites, and a dropped `data-tooltip-id` fails silently.
export const Icon = ({ name, style = 'solid', size, spin, className, title, ...rest }: IconProps) => {
	return (
		<i
			{...rest}
			className={clsx(ICON_STYLE_CLASS[style], `fa-${resolve(name)}`, size && `fa-${size}`, spin && 'fa-spin', className)}
			title={title}
			aria-hidden={title ? undefined : true}
		/>
	);
};
