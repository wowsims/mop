import i18n from '@i18n/config';

import { ADDON_IMPORTER } from '../../importers';
import { Importer } from './Importer';
import { ImportWarning } from './ImportWarning';
import type { ImporterDialogProps } from './types';

export const AddonImporterDialog = ({ open, onOpenChange }: ImporterDialogProps) => (
	<Importer open={open} onOpenChange={onOpenChange} {...ADDON_IMPORTER}>
		<div>
			<p>
				{i18n.t('import.addon.description')}{' '}
				<a href="https://www.curseforge.com/wow/addons/wowsimsexporter" target="_blank" rel="noopener noreferrer">
					{i18n.t('import.addon.addon_link')}
				</a>
				.
			</p>
			<p>{i18n.t('import.addon.feature_description')}</p>
			<p>{i18n.t('import.addon.instructions')}</p>
			<ImportWarning titleKey="import.addon.reforge_warning.title" messageKey="import.addon.reforge_warning.message" />
		</div>
	</Importer>
);
