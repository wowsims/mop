import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { useCopyToClipboard } from '@ui-kit/hooks/useCopyToClipboard';
import { Icon } from '@ui-kit/Icon';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx, { type ClassValue } from 'clsx';
import { useId } from 'react';

export interface CopyButtonProps {
	/** Read at click time, not at mount: the reforge toast re-exports the whole sim on every click. */
	getContent: () => string;
	className?: ClassValue;
	text?: string;
	tooltip?: string;
	/** Vanilla's `postClickEvent`, fired after the copy is started — the no-clipboard branch included. */
	onCopied?: () => void;
}

/**
 * Parameterises the label, the class list and the tooltip; fixes `copy-button` — the class the
 * vanilla `Component` root carried and every React caller of `useCopyToClipboard` writes by hand — and
 * the copy itself: the check icon and the "copied" label for 1500ms, further clicks ignored inside it.
 */
export const CopyButton = ({ getContent, className, text, tooltip, onCopied }: CopyButtonProps) => {
	const { copy, copied } = useCopyToClipboard(getContent);
	const tooltipId = useId();

	const onClick = () => {
		// `navigator.clipboard` is absent on an insecure origin. Vanilla shows the payload instead and never enters the copied window, so a second click alerts again.
		if (navigator.clipboard == undefined) {
			alert(getContent());
		} else {
			if (copied) return;
			copy();
		}
		onCopied?.();
	};

	return (
		<>
			<Button variant={null} className={clsx('copy-button', className)} onClick={onClick} {...(tooltip ? tooltipAnchorProps(tooltipId) : {})}>
				<Icon name={copied ? 'check' : 'copy'} className="me-1" />
				{copied ? i18n.t('common.copy_button.copied') : (text ?? i18n.t('common.copy_button.default_text'))}
			</Button>
			{tooltip && <Tooltip id={tooltipId} content={tooltip} />}
		</>
	);
};
