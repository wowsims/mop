import { usePlayer } from '@sim/context/SimHostContext';
import { useInput } from '@ui-kit/hooks/useInput';
import { useWowheadDataset } from '@ui-kit/hooks/useWowheadDataset';
import { PickerShell } from '@ui-kit/PickerShell';
import { useMemo } from 'react';

import { emptyGlyphData, type GlyphData, type GlyphField, glyphInputConfig, glyphTooltipData, glyphUrl } from './utils';

export interface GlyphPickerProps {
	field: GlyphField;
	options: GlyphData[];
	onOpen: (field: GlyphField) => void;
}

export const GlyphPicker = ({ field, options, onOpen }: GlyphPickerProps) => {
	const player = usePlayer();
	const config = useMemo(() => glyphInputConfig(field), [field]);
	const { value, hidden, disabled } = useInput(player, config);
	const selected = options.find(option => option.id === value);
	const shown = selected ?? emptyGlyphData;

	const resolveTooltip = useMemo(() => (selected ? () => glyphTooltipData(selected) : null), [selected]);
	const wowheadProps = useWowheadDataset(resolveTooltip);

	return (
		<PickerShell config={config} className="mb-0 flex-1 flex-row" testId="glyph-picker-root" hidden={hidden} disabled={disabled}>
			<a
				className="flex gap-3 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-link"
				data-testid="glyph-link"
				role="button"
				href={selected ? glyphUrl(selected) : undefined}
				data-whtticon="false"
				onClick={event => {
					event.preventDefault();
					onOpen(field);
				}}
				{...wowheadProps}>
				<img
					className="relative inline-block size-12 cursor-pointer border border-border bg-cover bg-center bg-no-repeat"
					data-testid="item-picker-icon"
					src={shown.iconUrl}
				/>
				<div className="flex flex-1 flex-col items-start justify-center p-0" data-testid="item-picker-labels-container">
					<span className="text-(length:--h6-font-size) text-white" data-testid="item-picker-name-container">
						{shown.name}
					</span>
				</div>
			</a>
		</PickerShell>
	);
};
