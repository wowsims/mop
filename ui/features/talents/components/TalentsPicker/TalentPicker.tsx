import i18n from '@i18n/config';
import { getClassI18nKey } from '@i18n/entity_mapping';
import { usePlayer } from '@sim/context/SimHostContext';
import { ActionId } from '@sim/proto/action_id';
import type { TalentConfig } from '@sim/talents/config';
import { externalRel } from '@sim/utils/links';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { isRightClick } from '@ui-kit/utils/dom';
import { useEffect, useRef } from 'react';

import { selectedColumn, withTalentCleared, withTalentSelected } from './utils/talents_string';

export interface TalentPickerProps<TalentsProto> {
	config: TalentConfig<TalentsProto>;
	talentsString: string;
	onChange: (next: string) => void;
}

const LONG_TOUCH_MS = 750;

export const TalentPicker = <TalentsProto,>({ config, talentsString, onChange }: TalentPickerProps<TalentsProto>) => {
	const player = usePlayer();
	const rootRef = useRef<HTMLAnchorElement>(null);
	const actionId = ActionId.fromSpellId(config.spellId);
	const { iconUrl, href } = useActionId(actionId);
	const selected = selectedColumn(talentsString, config.location.rowIdx) === config.location.colIdx;
	const label = i18n.t(`${getClassI18nKey(player.getClass())}.${String(config.fieldName)}`, { ns: 'talents' }) || config.fancyName;

	const select = () => onChange(withTalentSelected(talentsString, config.location));
	const clear = () => onChange(withTalentCleared(talentsString, config.location));

	// The native listeners are attached once, so they read the current handlers through a ref rather than re-attaching on every talents-string change.
	const handlers = useRef({ select, clear });
	handlers.current = { select, clear };

	useEffect(() => {
		const elem = rootRef.current;
		if (!elem) return;

		let timer: number | undefined;
		const cancel = () => {
			if (timer === undefined) return false;
			clearTimeout(timer);
			timer = undefined;
			return true;
		};
		const onTouchStart = (event: TouchEvent) => {
			event.preventDefault();
			timer = window.setTimeout(() => {
				timer = undefined;
				handlers.current.clear();
			}, LONG_TOUCH_MS);
		};
		const onTouchEnd = (event: TouchEvent) => {
			event.preventDefault();
			// The long press already fired and cleared the timer; releasing must not then re-spend it.
			if (!cancel()) return;
			handlers.current.select();
		};

		elem.addEventListener('touchmove', cancel);
		// React registers touchstart as a passive listener, where preventDefault is ignored.
		elem.addEventListener('touchstart', onTouchStart, { passive: false });
		elem.addEventListener('touchend', onTouchEnd, { passive: false });
		return () => {
			cancel();
			elem.removeEventListener('touchmove', cancel);
			elem.removeEventListener('touchstart', onTouchStart);
			elem.removeEventListener('touchend', onTouchEnd);
		};
	}, []);

	return (
		<a
			ref={rootRef}
			className="ui-talent-picker-root flex items-center gap-2 border-2 border-transparent p-2 data-[selected=true]:border-(--talent-border-color)"
			data-testid="talent-picker-root"
			href={href || undefined}
			rel={externalRel(href, undefined)}
			data-selected={String(selected)}
			// The anchor is a wowhead link, so following it has to be suppressed; and `mousedown` rather than `click` is what commits, which is why a right click reaches it at all.
			onClick={event => event.preventDefault()}
			onContextMenu={event => event.preventDefault()}
			onMouseDown={event => (isRightClick(event.nativeEvent) ? handlers.current.clear() : handlers.current.select())}>
			<div
				className="relative inline-block size-10 cursor-pointer rounded-sm border border-(--talent-border-color) bg-cover bg-center bg-no-repeat"
				data-testid="talent-picker-icon"
				style={iconUrl ? { backgroundImage: `url('${iconUrl}')` } : undefined}
			/>
			<div className="text-(length:--btn-font-size) text-white" data-whtticon="false">
				{label}
			</div>
		</a>
	);
};
