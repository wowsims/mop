import i18n from '@i18n/config';

import { JSON_IMPORTER } from '../../importers';
import { Importer } from './Importer';
import type { ImporterDialogProps } from './types';

export const JsonImporterDialog = ({ open, onOpenChange }: ImporterDialogProps) => (
	<Importer open={open} onOpenChange={onOpenChange} {...JSON_IMPORTER}>
		<div>
			<p>{i18n.t('import.json.description')}</p>
			<p>{i18n.t('import.json.instructions')}</p>
		</div>
	</Importer>
);
