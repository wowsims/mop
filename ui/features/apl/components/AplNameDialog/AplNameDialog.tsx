import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { Dialog } from '@ui-kit/Dialog';
import { FieldLabel, Input } from '@ui-kit/FormControl';
import { useEffect, useId, useRef, useState } from 'react';

export interface AplNameDialogProps {
	open: boolean;
	title: string;
	inputLabel: string;
	/** The confirm button's text. Defaults to "Create". */
	confirmLabel?: string;
	placeholder?: string;
	defaultValue?: string;
	/** Names already taken; typing one of them blocks the confirm button. */
	existingNames: Array<string>;
	onSubmit: (name: string) => void;
	/** Closed without submitting — how a freshly created placeholder undoes itself. */
	onCancel?: () => void;
	onClose: () => void;
}

/**
 * "Name this thing" — the one dialog behind creating and renaming groups, variables and variable
 * placeholders, and behind extracting a value to a variable.
 *
 * The name is component state rather than an uncontrolled input read on submit: the confirm
 * button's disabled state, the `aria-invalid` ring and the conflict message are all derived from it.
 */
export const AplNameDialog = ({
	open,
	title,
	inputLabel,
	confirmLabel,
	placeholder,
	defaultValue,
	existingNames,
	onSubmit,
	onCancel,
	onClose,
}: AplNameDialogProps) => {
	const inputId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const [name, setName] = useState(defaultValue || '');

	// Each opening starts from the value it was given, and focuses the field once it is on screen.
	useEffect(() => {
		if (!open) return;
		setName(defaultValue || '');
		inputRef.current?.focus();
	}, [open, defaultValue]);

	const trimmed = name.trim();
	const conflict = !!trimmed && existingNames.some(existing => existing === trimmed);
	const canSubmit = !!trimmed && !conflict;

	const submit = () => {
		if (!canSubmit) return;
		onSubmit(trimmed);
		onClose();
	};

	return (
		<Dialog
			open={open}
			onOpenChange={next => {
				if (next) return;
				onCancel?.();
				onClose();
			}}
			size="sm"
			title={title}
			footer={
				<Button variant="primary" disabled={!canSubmit} onClick={submit}>
					{confirmLabel || i18n.t('rotation_tab.apl.nameModal.create')}
				</Button>
			}>
			<div>
				<FieldLabel htmlFor={inputId}>{inputLabel}</FieldLabel>
				<Input
					id={inputId}
					ref={inputRef}
					type="text"
					aria-invalid={conflict}
					placeholder={placeholder || ''}
					value={name}
					onChange={event => setName(event.target.value)}
					onKeyDown={event => {
						if (event.key === 'Enter') submit();
					}}
				/>
				<div>{conflict ? i18n.t('rotation_tab.apl.nameModal.nameConflict') : ''}</div>
			</div>
		</Dialog>
	);
};
