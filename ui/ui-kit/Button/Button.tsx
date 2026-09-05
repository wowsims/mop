import { Button as BaseButton } from '@base-ui/react/button';
import clsx from 'clsx';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

/** The `btn btn-*` shapes the tree actually uses. */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'link' | 'outline-primary' | 'outline-light' | 'outline-cancel';

interface ButtonBaseProps {
	/** `null` emits a bare `btn` — the talents tree's reset is `btn link-danger`. */
	variant?: ButtonVariant | null;
	size?: 'sm';
	className?: string;
	children?: ReactNode;
}

type ButtonAsButton = ButtonBaseProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & { as?: 'button' };

// `href` is required, because every anchor-shaped control in the tree is an anchor only for the
// wowhead link it carries.
type ButtonAsAnchor = ButtonBaseProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'> & { as: 'a'; href: string };

export type ButtonProps = ButtonAsButton | ButtonAsAnchor;

export const Button = (props: ButtonProps) => {
	const variant = props.variant === undefined ? 'primary' : props.variant;
	const classes = clsx('btn', variant && `btn-${variant}`, props.size && `btn-${props.size}`, props.className);

	// A plain anchor, deliberately not `Base.Button`. Its docs: "Links (`<a>`) have their own
	// semantics and should not be rendered as buttons through the `render` prop." Every
	// anchor-shaped control here is an anchor *because* of the wowhead link it carries, so it is a
	// link that looks like a button, not the reverse — wrapping it would layer `role="button"` and
	// keyboard handlers on top of link semantics.
	if (props.as === 'a') {
		const { as: _as, variant: _variant, size: _size, className: _className, children, ...anchorProps } = props;
		return (
			<a className={classes} {...anchorProps}>
				{children}
			</a>
		);
	}

	// `type` is defaulted here rather than by Base UI, which does not do it: a <button> inside a
	// form submits it otherwise, and several in this tree are inside forms.
	const { as: _as, variant: _variant, size: _size, className: _className, children, type = 'button', ...buttonProps } = props;
	return (
		<BaseButton className={classes} type={type} {...buttonProps}>
			{children}
		</BaseButton>
	);
};
