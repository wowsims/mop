import i18n from '@i18n/config';
import { usePlayer } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import type { TalentsConfig } from '@sim/talents/config';
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
		<PickerShell
			config={{ ...config, id: config.id ?? fallbackId }}
			className="col-span-full w-fit flex flex-row gap-section max-fhd:flex-col max-xl:m-auto max-md:w-full"
			hidden={hidden}
			disabled={disabled}>
			<div className="flex flex-col max-lg:w-full">
				<div className="w-full mb-1 flex items-center">
					<div className="ml-auto" data-testid="talents-picker-actions">
						<Button
							variant="outline-primary"
							size="sm"
							className="w-24"
							data-testid="copy-button"
							onClick={copy}
							{...tooltipAnchorProps(copyTooltipId)}>
							<Icon name={copied ? 'check' : 'copy'} className="mr-1" />
							{copied ? i18n.t('common.copy_button.copied') : i18n.t('talents_tab.copy_button.label')}
						</Button>
						<Tooltip id={copyTooltipId} content={i18n.t('talents_tab.copy_button.tooltip')} />
					</div>
				</div>
				<div id="talents" className="flex-1 max-lg:flex max-lg:justify-center max-lg:overflow-x-hidden max-lg:-mx-page">
					<TalentTreePicker config={config.tree} talentsString={value} onChange={setValue} />
				</div>
			</div>
			<GlyphsPicker />
		</PickerShell>
	);
};
