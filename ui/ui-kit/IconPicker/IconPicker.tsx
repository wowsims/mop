import { isRightClick } from '@domain/env';
import { externalRel } from '@domain/links';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { useInput } from '@ui-kit/hooks/useInput';
import type { IconPickerConfig } from '@ui-kit/pickers/icon_picker';
import { PickerShell } from '@ui-kit/PickerShell';
import { wowheadAnchorProps } from '@ui-kit/wowhead';
import clsx from 'clsx';
import { useEffect, useRef } from 'react';

import { ImprovedAnchor } from './ImprovedAnchor';

export interface IconPickerProps<ModObject, ValueType> {
	modObject: ModObject;
	config: IconPickerConfig<ModObject, ValueType>;
}

export const IconPicker = <ModObject, ValueType>({ modObject, config }: IconPickerProps<ModObject, ValueType>) => {
	const { value, setValue, hidden: showWhenHidden, disabled, revision } = useInput(modObject, config);
	const currentValue = Number(value);

	// getInputValue()/setInputValue(): the source is a bi-state boolean at states === 2, a plain
	// number otherwise.
	const toSourceValue = (n: number): ValueType => (config.states === 2 ? Boolean(n) : n) as unknown as ValueType;

	// showWhen() is overridden on the vanilla picker to also require an actionId.
	const hidden = config.actionId == null || showWhenHidden;

	// storeValue()/restoreValue(): remember the value across a hide, zero it while hidden, and put it
	// back on the way back in. Vanilla drives this from its source subscription, so it never runs
	// during construction and it runs on EVERY notification — a picker that mounts hidden over a
	// non-zero source is zeroed by the first one, not by a transition. Keying on the revision rather
	// than on a one-shot flag keeps both true, and stays correct when StrictMode replays the effect.
	const storedValue = useRef<ValueType | undefined>(undefined);
	const lastRevision = useRef<number | null>(null);
	useEffect(() => {
		if (lastRevision.current === revision) return;
		const construction = lastRevision.current === null;
		lastRevision.current = revision;
		if (construction) return;

		if (hidden) {
			if (storedValue.current === undefined) {
				storedValue.current = value;
				setValue(toSourceValue(0));
			}
		} else if (storedValue.current !== undefined) {
			const restored = storedValue.current;
			storedValue.current = undefined;
			setValue(toSourceValue(Number(restored)));
		}
	});

	const { iconUrl, href } = useActionId(config.actionId);

	const useImprovedIcons = Boolean(config.improvedId);
	const fillImproved1 = config.states >= 3 && !!config.improvedId;
	const fillImproved2 = config.states >= 4 && !!config.improvedId2;
	const showCounterText = !config.improvedId && (config.states > 3 || config.states === 0);

	const handleLeftClick = () => {
		if (config.states === 0 || currentValue + 1 < config.states) {
			setValue(toSourceValue(currentValue + 1));
		} else if (currentValue > 0) {
			setValue(toSourceValue(0));
		}
	};

	const handleRightClick = () => {
		if (currentValue > 0) {
			setValue(toSourceValue(currentValue - 1));
		} else {
			setValue(toSourceValue(config.states === 0 ? 1 : config.states - 1));
		}
	};

	// `Input.update()` writes `disabled` on the input element as well as the class on the root, and
	// `disabled` is not in React's anchor prop types because HTML has no such attribute on <a>.
	const disabledAttribute = (disabled ? { disabled: true } : {}) as Record<string, boolean>;

	// The nested anchors are what vanilla builds; React logs a validateDOMNesting warning for them in
	// dev and vitest. Both sides build this DOM through DOM APIs, so nothing is re-parented.
	const main = (
		<a
			className={clsx(
				'icon-picker-button',
				useImprovedIcons && 'use-improved-icons',
				config.improvedId2 && 'use-improved-icons2',
				!useImprovedIcons && config.states > 2 && 'use-counter',
				currentValue > 0 && 'active',
			)}
			{...wowheadAnchorProps()}
			target="_blank"
			href={href || undefined}
			rel={externalRel(href, undefined)}
			style={iconUrl ? { backgroundImage: `url('${iconUrl}')` } : undefined}
			{...disabledAttribute}
			onClick={event => {
				event.preventDefault();
				handleLeftClick();
			}}
			onContextMenu={event => event.preventDefault()}
			onMouseDown={event => {
				if (isRightClick(event.nativeEvent)) {
					event.preventDefault();
					handleRightClick();
				}
			}}>
			<div className="icon-input-level-container">
				<ImprovedAnchor
					actionId={fillImproved1 ? config.improvedId : undefined}
					className="icon-input-improved1"
					active={fillImproved1 && currentValue > 1}
					hidden={fillImproved2 && currentValue > 2}
				/>
				<ImprovedAnchor
					actionId={fillImproved2 ? config.improvedId2 : undefined}
					className="icon-input-improved2"
					active={fillImproved2 && currentValue > 2}
					hidden={fillImproved2 && !(currentValue > 2)}
				/>
				<span className={clsx('icon-picker-label', config.states <= 2 && 'hide', currentValue > 0 && 'active')}>
					{showCounterText ? String(currentValue) : null}
				</span>
			</div>
		</a>
	);

	// IconPickerConfig, unlike the other picker configs, does not narrow InputConfig's `id` to
	// required — PickerShell needs one to wire the label's `htmlFor` and tooltip id.
	return (
		<PickerShell
			config={config as typeof config & { id: string }}
			cssClass="icon-picker-root icon-picker"
			hidden={hidden}
			disabled={disabled}
			leading={main}
		/>
	);
};
