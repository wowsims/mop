import { RaidSimRequest } from '@generated/proto/api';
import i18n from '@i18n/config';

import type { ExporterDefinition } from './types';

export const CLI_EXPORTER: ExporterDefinition = {
	title: i18n.t('export.cli.title'),
	allowDownload: true,
	getData: host => {
		const raidSimJson: any = RaidSimRequest.toJson(
			host.sim.makeRaidSimRequest({
				debug: false,
			}),
		);
		delete raidSimJson.raid?.parties[0]?.players[0]?.database;
		return JSON.stringify(raidSimJson, null, 2);
	},
};
