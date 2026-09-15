import i18n from '@i18n/config';

import { BULK_GEAR_IMPORTER } from '../../importers';
import { Importer } from './Importer';
import type { ImporterDialogProps } from './types';

export const BulkGearImporterDialog = ({ open, onOpenChange }: ImporterDialogProps) => (
	<Importer open={open} onOpenChange={onOpenChange} {...BULK_GEAR_IMPORTER}>
		<p>{i18n.t('bulk_tab.import_modal.description_line1')}</p>
		<p>{i18n.t('bulk_tab.import_modal.description_line2')}</p>
	</Importer>
);
