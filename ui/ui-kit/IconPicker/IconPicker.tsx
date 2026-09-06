import { isRightClick } from '@domain/env';
import { externalRel } from '@domain/links';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { useInput } from '@ui-kit/hooks/useInput';
import type { IconPickerConfig } from '@ui-kit/pickers/icon_picker';
import { PickerShell } from '@ui-kit/PickerShell';
import { wowheadAnchorProps } from '@ui-kit/wowhead';
import clsx from 'clsx';
import { type MouseEvent, useEffect, useRef } from 'react';

import { ImprovedAnchor } from './ImprovedAnchor';

export interface IconPickerProps<ModObject, ValueType> {
	modObject: ModObject;
	config: IconPickerConfig<ModObject, ValueType>;
}

export const IconPicker = <ModObject, ValueType>({ modObject, config }: IconPickerProps<ModObject, ValueType>) => {
	const { value, setValue, hidden: showWhenHidden, disabled, revision } = useInput(modObject, config);
	const currentValue = Number(value);

	const toSourceValue = (n: number): ValueType => (config.states === 2 ? Boolean(n) : n) as unknown as ValueType;

	const hidden = config.actionId == null || showWhenHidden;

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

	const { iconUrl, href, name } = useActionId(config.actionId);

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

	// `Input.update()` writes `disabled` on the input element as well as the class on the root, and `disabled` is not in React's anchor prop types because HTML has no such attribute on <a>.
	const disabledAttribute = (disabled ? { disabled: true } : {}) as Record<string, boolean>;

	// The level container overlays the anchor rather than sitting inside it, so a click on the improved icons reaches these only by carrying them on both.
	const stateEvents = {
		onClick: (event: MouseEvent) => {
			event.preventDefault();
			handleLeftClick();
		},
		onContextMenu: (event: MouseEvent) => event.preventDefault(),
		onMouseDown: (event: MouseEvent) => {
			if (isRightClick(event.nativeEvent)) {
				event.preventDefault();
				handleRightClick();
			}
		},
	};

	const main = (
		<>
			<a
				className={clsx(
					'icon-picker-button',
					useImprovedIcons && 'use-improved-icons',
					config.improvedId2 && 'use-improved-icons2',
					!useImprovedIcons && config.states > 2 && 'use-counter',
					currentValue > 0 && 'active',
				)}
				{...wowheadAnchorProps()}
				// The glyph is a background image and the counter is a sibling now, so without this the
				// anchor announces nothing; `name` is empty until `useActionId` resolves.
				aria-label={name || undefined}
				target="_blank"
				href={href || undefined}
				rel={externalRel(href, undefined)}
				style={iconUrl ? { backgroundImage: `url('${iconUrl}')` } : undefined}
				{...disabledAttribute}
				{...stateEvents}
			/>
			<div className="icon-input-level-container" {...stateEvents}>
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
		</>
	);

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
