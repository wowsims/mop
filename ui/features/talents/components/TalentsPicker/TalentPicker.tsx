import { isRightClick } from '@domain/env';
import { externalRel } from '@domain/links';
import { ActionId } from '@domain/proto_utils/action_id';
import type { TalentConfig } from '@domain/talents/config';
import { usePlayer } from '@features/SimHostContext';
import i18n from '@i18n/config';
import { getClassI18nKey } from '@i18n/entity_mapping';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { useEffect, useMemo, useRef } from 'react';

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
	const actionId = useMemo(() => ActionId.fromSpellId(config.spellId), [config.spellId]);
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
		elem.addEventListener('touchstart', onTouchStart);
		elem.addEventListener('touchend', onTouchEnd);
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
			className="talent-picker-root"
			href={href || undefined}
			rel={externalRel(href, undefined)}
			data-selected={String(selected)}
			// The anchor is a wowhead link, so following it has to be suppressed; and `mousedown` rather than `click` is what commits, which is why a right click reaches it at all.
			onClick={event => event.preventDefault()}
			onContextMenu={event => event.preventDefault()}
			onMouseDown={event => (isRightClick(event.nativeEvent) ? handlers.current.clear() : handlers.current.select())}>
			<div className="talent-picker-icon" style={iconUrl ? { backgroundImage: `url('${iconUrl}')` } : undefined} />
			<div className="talent-picker-label" data-whtticon="false">
				{label}
			</div>
		</a>
	);
};
