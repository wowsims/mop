// A FontAwesome glyph.
//
// Replaces hand-written `<i className="fas fa-times fa-lg" />` spans, of which the tree had 64
// across 37 files and 11 features. The value is not the markup — it is that `name`, `style` and
// `size` are closed unions, so the failure modes that markup allowed cannot compile:
//
//   - a name that does not exist, or an FA5 alias where a sibling file used the FA6 spelling
//   - a size that is not a FontAwesome size (`fa-1xl` was live in toast.tsx and did nothing)
//   - two glyph classes on one element, where which one renders is left to stylesheet order
import clsx from 'clsx';

import { ICON_ALIASES, ICON_STYLE_CLASS, type IconAlias, type IconName, type IconSize, type IconStyle } from './types';

export interface IconProps {
	name: IconName | IconAlias;
	style?: IconStyle;
	size?: IconSize;
	/** Renders the spin animation, rather than smuggling `fa-spin` in through a class name. */
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
