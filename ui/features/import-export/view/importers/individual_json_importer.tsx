/** @jsxImportSource @jsx-vanilla */
import { Database } from '@domain/proto_utils/database';
import type { IndividualSimHost } from '@features/sim_host';
import { Spec } from '@generated/proto/common';
import { IndividualSimSettings } from '@generated/proto/ui';
import i18n from '@i18n/config';

import { IndividualImporter } from './individual_importer';
export class IndividualJsonImporter<SpecType extends Spec> extends IndividualImporter<SpecType> {
	constructor(parent: HTMLElement, simUI: IndividualSimHost<SpecType>) {
		super(parent, simUI, { title: i18n.t('import.json.title'), allowFileUpload: true });

		this.descriptionElem.appendChild(
			<div>
				<p>{i18n.t('import.json.description')}</p>
				<p>{i18n.t('import.json.instructions')}</p>
			</div>,
		);
	}

	async onImport(data: string) {
		let proto: ReturnType<typeof IndividualSimSettings.fromJsonString> | null = null;
		try {
			proto = IndividualSimSettings.fromJsonString(data, { ignoreUnknownFields: true });
		} catch {
			throw new Error(i18n.t('import.json.error_invalid_json'));
		}
		if (proto.player?.equipment) {
			await Database.loadLeftoversIfNecessary(proto.player.equipment);
		}
		this.simUI.fromProto(proto);
		this.close();
	}
}