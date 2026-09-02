import { RaidSimRequest } from '@generated/proto/api';
import { Spec } from '@generated/proto/common';
import i18n from '@i18n/config';

import type { IndividualSimHost } from '../../../sim_host';
import { IndividualExporter } from './individual_exporter';

export class IndividualCLIExporter<SpecType extends Spec> extends IndividualExporter<SpecType> {
	constructor(parent: HTMLElement, simUI: IndividualSimHost<SpecType>) {
		super(parent, simUI, { title: i18n.t('export.cli.title'), allowDownload: true });
	}

	getData(): string {
		const raidSimJson: any = RaidSimRequest.toJson(
			this.simUI.sim.makeRaidSimRequest({
				debug: false,
			}),
		);
		delete raidSimJson.raid?.parties[0]?.players[0]?.database;
		return JSON.stringify(raidSimJson, null, 2);
	}
}
