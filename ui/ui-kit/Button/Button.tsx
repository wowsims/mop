import { Button as BaseButton } from '@base-ui/react/button';
import { externalRel } from '@sim/utils/links';
import clsx from 'clsx';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, LabelHTMLAttributes, ReactNode, Ref } from 'react';

import { BASE, LINK_BASE, SIZE, VARIANT } from './classes';

export type ButtonVariant =
	| 'primary'
	| 'secondary'
	| 'danger'
	| 'cancel'
	| 'link'
	| 'link-danger'
	| 'outline-primary'
	| 'outline-light'
	| 'outline-cancel'
	| 'unstyled';

interface ButtonBaseProps {
	/** `null` emits the bare base bundle — no colour of its own. */
	variant?: ButtonVariant | null;
	size?: 'sm' | 'inline';
	className?: string;
	children?: ReactNode;
}

type ButtonAsButton = ButtonBaseProps &
	Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & { as?: 'button'; ref?: Ref<HTMLButtonElement> };

type ButtonAsAnchor = ButtonBaseProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'> & { as: 'a'; href: string };

type ButtonAsLabel = ButtonBaseProps & Omit<LabelHTMLAttributes<HTMLLabelElement>, 'className' | 'children'> & { as: 'label'; htmlFor: string };

export type ButtonProps = ButtonAsButton | ButtonAsAnchor | ButtonAsLabel;

export const Button = (props: ButtonProps) => {
	const variant = props.variant === undefined ? 'primary' : props.variant;
	const isLink = variant === 'link' || variant === 'link-danger';
	const classes =
		variant === 'unstyled'
			? props.className
			: clsx(isLink ? LINK_BASE : BASE, variant && VARIANT[variant], !isLink && props.size && SIZE[props.size], props.className);

	if (props.as === 'label') {
		const { as: _as, variant: _variant, size: _size, className: _className, children, ...labelProps } = props;
		return (
			<label className={classes} {...labelProps}>
				{children}
			</label>
		);
	}

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
