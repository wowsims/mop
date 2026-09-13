import type { ActionId } from '@sim/proto/action_id';
import { externalRel } from '@sim/utils/links';
import { useActionIdWowheadDataset } from '@ui-kit/hooks/useActionIdWowheadDataset';
import clsx from 'clsx';
import { forwardRef, type ReactNode, useRef } from 'react';

export interface WowheadIconProps {
	as?: 'a' | 'div';
	iconUrl?: string;
	href?: string;
	actionId?: ActionId | null;
	useBuffAura?: boolean;
	label?: string;
	className?: string;
	children?: ReactNode;
}

export const WowheadIcon = forwardRef<HTMLElement, WowheadIconProps>(({ as = 'a', iconUrl, href, actionId, useBuffAura, label, className, children }, ref) => {
	const ownRef = useRef<HTMLElement>(null);

	const setRefs = (node: HTMLElement | null) => {
		ownRef.current = node;
		if (typeof ref === 'function') ref(node);
		else if (ref) ref.current = node;
	};

	useActionIdWowheadDataset(ownRef, actionId ?? null, useBuffAura);

	const Tag = as as 'a';
	const anchorProps = as === 'a' ? { href, rel: externalRel(href, undefined) } : {};

	return (
		<Tag
			ref={setRefs as never}
			className={clsx('relative inline-block bg-cover bg-center bg-no-repeat', className)}
			{...anchorProps}
			aria-label={label}
			style={iconUrl ? { backgroundImage: `url('${iconUrl}')` } : undefined}>
			{children}
		</Tag>
	);
});
WowheadIcon.displayName = 'WowheadIcon';
