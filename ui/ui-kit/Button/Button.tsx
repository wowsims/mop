import { Button as BaseButton } from '@base-ui/react/button';
import { externalRel } from '@domain/links';
import clsx from 'clsx';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'link' | 'outline-primary' | 'outline-light' | 'outline-cancel' | 'unstyled';

interface ButtonBaseProps {
	/** `null` emits a bare `btn` — the talents tree's reset is `btn link-danger`. */
	variant?: ButtonVariant | null;
	size?: 'sm';
	className?: string;
	children?: ReactNode;
}

type ButtonAsButton = ButtonBaseProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & { as?: 'button' };

type ButtonAsAnchor = ButtonBaseProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'> & { as: 'a'; href: string };

export type ButtonProps = ButtonAsButton | ButtonAsAnchor;

export const Button = (props: ButtonProps) => {
	const variant = props.variant === undefined ? 'primary' : props.variant;
	const classes = variant === 'unstyled' ? props.className : clsx('btn', variant && `btn-${variant}`, props.size && `btn-${props.size}`, props.className);

	// A plain anchor, deliberately not `Base.Button`.
	if (props.as === 'a') {
		const { as: _as, variant: _variant, size: _size, className: _className, children, ...anchorProps } = props;
		return (
			<a className={classes} {...anchorProps} rel={externalRel(anchorProps.href, anchorProps.rel)}>
				{children}
			</a>
		);
	}

	// `type` is defaulted here rather than by Base UI, which does not do it: a <button> inside a form submits it otherwise, and several in this tree are inside forms.
	const { as: _as, variant: _variant, size: _size, className: _className, children, type = 'button', ...buttonProps } = props;
	return (
		<BaseButton className={classes} type={type} {...buttonProps}>
			{children}
		</BaseButton>
	);
};
