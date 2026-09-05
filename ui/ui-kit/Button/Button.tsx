import clsx from 'clsx';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

/** The `btn btn-*` shapes the tree actually uses. */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'link' | 'outline-primary' | 'outline-light' | 'outline-cancel';

interface ButtonBaseProps {
	variant?: ButtonVariant;
	size?: 'sm';
	className?: string;
	children?: ReactNode;
}

type ButtonAsButton = ButtonBaseProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & { as?: 'button' };

// `href` is required, because every anchor-shaped control in the tree is an anchor only for the
// wowhead link it carries.
type ButtonAsAnchor = ButtonBaseProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'> & { as: 'a'; href: string };

export type ButtonProps = ButtonAsButton | ButtonAsAnchor;

export function Button(props: ButtonProps) {
	const classes = clsx('btn', `btn-${props.variant ?? 'primary'}`, props.size && `btn-${props.size}`, props.className);

	if (props.as === 'a') {
		const { as: _as, variant: _variant, size: _size, className: _className, children, ...anchorProps } = props;
		return (
			<a className={classes} {...anchorProps}>
				{children}
			</a>
		);
	}

	// Defaulted, because a <button> in a form submits it otherwise — several in the tree do.
	const { as: _as, variant: _variant, size: _size, className: _className, children, type = 'button', ...buttonProps } = props;
	return (
		<button className={classes} type={type} {...buttonProps}>
			{children}
		</button>
	);
}
