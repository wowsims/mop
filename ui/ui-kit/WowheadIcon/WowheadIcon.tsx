import type { ActionId } from '@sim/proto/action_id';
import { externalRel } from '@sim/utils/links';
import { useActionIdWowheadDataset } from '@ui-kit/hooks/useActionIdWowheadDataset';
import clsx from 'clsx';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export interface WowheadIconProps extends ComponentPropsWithoutRef<'a'> {
	as?: 'a' | 'div';
	iconUrl?: string;
	href?: string;
	actionId?: ActionId | null;
	useBuffAura?: boolean;
	label?: string;
	className?: string;
	testId?: string;
	children?: ReactNode;
}

export const WowheadIcon = ({ as = 'a', iconUrl, href, actionId, useBuffAura, label, className, testId, children, ...rest }: WowheadIconProps) => {
	const wowheadProps = useActionIdWowheadDataset(actionId ?? null, useBuffAura);

	const Tag = as as 'a';
	const anchorProps = as === 'a' ? { href, rel: externalRel(href, undefined) } : {};

	return (
		<Tag
			className={clsx('relative inline-block bg-cover bg-center bg-no-repeat', className)}
			{...anchorProps}
			data-testid={testId}
			aria-label={label}
			style={iconUrl ? { backgroundImage: `url('${iconUrl}')` } : undefined}
			{...wowheadProps}
			{...rest}>
			{children}
		</Tag>
	);
};
