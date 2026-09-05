// A FontAwesome glyph. `name`, `style` and `size` are closed unions, so a nonexistent glyph, an
// invalid size or two glyph classes on one element cannot compile.
import clsx from 'clsx';

import { ICON_ALIASES, ICON_STYLE_CLASS, type IconAlias, type IconName, type IconSize, type IconStyle } from './types';

export interface IconProps {
	name: IconName | IconAlias;
	style?: IconStyle;
	size?: IconSize;
	spin?: boolean;
	className?: string;
	title?: string;
}

const resolve = (name: IconName | IconAlias): IconName => (name in ICON_ALIASES ? ICON_ALIASES[name as IconAlias] : (name as IconName));

export function Icon({ name, style = 'solid', size, spin, className, title }: IconProps) {
	return (
		<i
			className={clsx(ICON_STYLE_CLASS[style], `fa-${resolve(name)}`, size && `fa-${size}`, spin && 'fa-spin', className)}
			title={title}
			aria-hidden={title ? undefined : true}
		/>
	);
}
