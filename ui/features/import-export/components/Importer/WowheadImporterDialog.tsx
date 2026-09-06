import { WOWHEAD_GEAR_PLANNER_URL } from '@domain/wowhead';
import i18n from '@i18n/config';

import { WOWHEAD_GEAR_PLANNER_IMPORTER } from '../../importers';
import { Importer } from './Importer';
import { ImportWarning } from './ImportWarning';
import type { ImporterDialogProps } from './types';

export const WowheadImporterDialog = ({ open, onOpenChange }: ImporterDialogProps) => (
	<Importer open={open} onOpenChange={onOpenChange} {...WOWHEAD_GEAR_PLANNER_IMPORTER}>
		<div>
			<p>
				{i18n.t('import.wowhead.description')}{' '}
				<a href={WOWHEAD_GEAR_PLANNER_URL} target="_blank" rel="noopener noreferrer">
					{i18n.t('import.wowhead.gear_planner_link')}
				</a>
				.
			</p>
			<p>{i18n.t('import.wowhead.feature_description')}</p>
			<p>{i18n.t('import.wowhead.instructions')}</p>
			<ImportWarning titleKey="import.wowhead.tinker_warning.title" messageKey="import.wowhead.tinker_warning.message" />
		</div>
	</Importer>
);
