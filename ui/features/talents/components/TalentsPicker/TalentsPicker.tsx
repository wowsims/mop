import { usePlayer } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player';
import type { TalentsConfig } from '@sim/talents/config';
import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { useCopyToClipboard } from '@ui-kit/hooks/useCopyToClipboard';
import { useInput } from '@ui-kit/hooks/useInput';
import { Icon } from '@ui-kit/Icon';
import type { InputConfig } from '@ui-kit/input';
import { PickerShell } from '@ui-kit/PickerShell';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import { useId } from 'react';

import { GlyphsPicker } from '../GlyphsPicker';
import { TalentTreePicker } from './TalentTreePicker';

export interface TalentsPickerConfig<ModObject, TalentsProto> extends InputConfig<ModObject, string> {
	tree: TalentsConfig<TalentsProto>;
}

export interface TalentsPickerProps<TalentsProto> {
	config: TalentsPickerConfig<Player<any>, TalentsProto>;
}

export const TalentsPicker = <TalentsProto,>({ config }: TalentsPickerProps<TalentsProto>) => {
	const player = usePlayer();
	const fallbackId = useId();
	const { value, setValue, hidden, disabled } = useInput(player, config);

	const copyTooltipId = useId();
	const { copy, copied } = useCopyToClipboard(() => player.getTalentsString());

	return (
		<PickerShell config={{ ...config, id: config.id ?? fallbackId }} cssClass="talents-picker-root" hidden={hidden} disabled={disabled}>
			<div className="talents-picker-inner">
				<div className="talents-picker-header">
					<div className="talents-picker-actions">
						<Button variant="outline-primary" size="sm" className="copy-talents copy-button" onClick={copy} {...tooltipAnchorProps(copyTooltipId)}>
							<Icon name={copied ? 'check' : 'copy'} className="me-1" />
							{copied ? i18n.t('common.copy_button.copied') : i18n.t('talents_tab.copy_button.label')}
						</Button>
						<Tooltip id={copyTooltipId} content={i18n.t('talents_tab.copy_button.tooltip')} />
					</div>
				</div>
				<div id="talents" className="talents-picker-list">
					<TalentTreePicker config={config.tree} talentsString={value} onChange={setValue} />
				</div>
			</div>
			<GlyphsPicker />
		</PickerShell>
	);
};
