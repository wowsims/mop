import './GlyphsPicker.scss';

import { usePlayer } from '@sim/context/SimHostContext';
import { Database } from '@sim/proto/database';
import { subscribePlayerField } from '@sim/state/subscriptions';
import { classGlyphsConfig } from '@sim/talents/factory';
import type { Class } from '@generated/proto/common';
import i18n from '@i18n/config';
import { ContentBlock } from '@ui-kit/ContentBlock';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { GlyphPicker } from './GlyphPicker';
import { GlyphSelectorDialog } from './GlyphSelectorDialog';
import { buildGlyphOptions, type GlyphField, GlyphKind, glyphOfField, majorGlyphFields, minorGlyphFields, setGlyph } from './utils';

export const GlyphsPicker = () => {
	const player = usePlayer();
	const playerClass = player.getClass() as Class;
	const glyphsConfig = classGlyphsConfig[playerClass];

	const [db, setDb] = useState<Database | null>(null);
	const [field, setField] = useState<GlyphField>(majorGlyphFields[0]);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		let live = true;
		Database.get().then(loaded => {
			if (live) setDb(loaded);
		});
		return () => {
			live = false;
		};
	}, []);

	const majorOptions = useMemo(() => (db ? buildGlyphOptions(glyphsConfig, GlyphKind.Major, playerClass, db) : []), [db, glyphsConfig, playerClass]);
	const minorOptions = useMemo(() => (db ? buildGlyphOptions(glyphsConfig, GlyphKind.Minor, playerClass, db) : []), [db, glyphsConfig, playerClass]);

	const glyphsSubscribe = useMemo(() => subscribePlayerField(player, 'glyphs'), [player]);
	const glyphs = useStoreSubscribe(glyphsSubscribe, () => player.getGlyphs());

	const onOpen = useCallback((next: GlyphField) => {
		setField(next);
		setOpen(true);
	}, []);

	const isMajor = (majorGlyphFields as ReadonlyArray<GlyphField>).includes(field);

	return (
		<div className="glyphs-picker-root">
			<ContentBlock className="major-glyphs" config={{ header: { title: i18n.t('talents_tab.glyphs.major'), className: 'border-0' } }}>
				{!!db && majorGlyphFields.map(major => <GlyphPicker key={major} field={major} options={majorOptions} onOpen={onOpen} />)}
			</ContentBlock>
			<ContentBlock className="minor-glyphs" config={{ header: { title: i18n.t('talents_tab.glyphs.minor'), className: 'border-0' } }}>
				{!!db && minorGlyphFields.map(minor => <GlyphPicker key={minor} field={minor} options={minorOptions} onOpen={onOpen} />)}
			</ContentBlock>
			<GlyphSelectorDialog
				open={open}
				onOpenChange={setOpen}
				options={isMajor ? majorOptions : minorOptions}
				selectedId={glyphOfField(glyphs, field)}
				onSelect={id => setGlyph(player, field, id)}
			/>
		</div>
	);
};
