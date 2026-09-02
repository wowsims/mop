import { Class, EquipmentSpec, Glyphs, Profession, Race, Spec } from '@core/proto/common';
import { Database } from '@domain/proto_utils/database';
import { classNames } from '@domain/proto_utils/names';
import { batch, nextEventID } from '@domain/state/batch';
import { LINK_CATEGORY_PARAM, LINK_DEFAULT_CATEGORIES } from '@domain/state/sim_links';
import Toast from '@ui-kit/toast';

import type { IndividualSimHost } from '../../../sim_host';
import { Importer, ImporterOptions } from '../importer';
// For now this just holds static helpers to match the exporter, so it doesn't extend Importer.
export abstract class IndividualImporter<SpecType extends Spec> extends Importer {
	// Exclude UISettings by default, since most users don't intend to export those.
	static readonly DEFAULT_CATEGORIES = LINK_DEFAULT_CATEGORIES;
	static readonly CATEGORY_PARAM = LINK_CATEGORY_PARAM;

	protected readonly simUI: IndividualSimHost<any>;

	constructor(parent: HTMLElement, simUI: IndividualSimHost<SpecType>, options: ImporterOptions) {
		super(parent, options);
		this.simUI = simUI;
	}

	protected async finishIndividualImport<SpecType extends Spec>(
		simUI: IndividualSimHost<SpecType>,
		{
			charClass,
			race,
			equipmentSpec,
			talentsStr,
			glyphs,
			professions,
			missingEnchants = [],
			missingItems = [],
		}: {
			charClass: Class;
			race: Race;
			equipmentSpec: EquipmentSpec;
			talentsStr: string;
			glyphs: Glyphs | null;
			professions: Profession[];
			missingEnchants?: number[];
			missingItems?: number[];
		},
	): Promise<void> {
		if (charClass != simUI.player.getClass()) {
			throw new Error(`Wrong Class! Expected ${simUI.player.getPlayerClass().friendlyName} but found ${classNames.get(charClass)}!`);
		}

		await Database.loadLeftoversIfNecessary(equipmentSpec);

		const gear = simUI.sim.db.lookupEquipmentSpec(equipmentSpec);

		// Now update settings using the parsed values.
		const eventID = nextEventID();
		batch(() => {
			simUI.player.setRace(eventID, race);
			simUI.player.setGear(eventID, gear);
			if (talentsStr && talentsStr != '--') {
				simUI.player.setTalentsString(eventID, talentsStr);
			}
			if (glyphs) {
				simUI.player.setGlyphs(eventID, glyphs);
			}
			if (professions.length > 0) {
				simUI.player.setProfessions(eventID, professions);
			}
		});

		this.close();

		if (missingItems.length == 0 && missingEnchants.length == 0) {
			new Toast({ variant: 'success', body: `Import successful!` });
		} else {
			new Toast({
				variant: 'info',
				body:
					'Import successful, but the following IDs were not found in the sim database:' +
					(missingItems.length == 0 ? '' : '\n\nItems: ' + missingItems.join(', ')) +
					(missingEnchants.length == 0 ? '' : '\n\nEnchants: ' + missingEnchants.join(', ')),
			});
		}
	}
}
