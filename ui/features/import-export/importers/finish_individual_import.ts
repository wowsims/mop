import { Database } from '@domain/proto_utils/database';
import { classNames } from '@domain/proto_utils/names';
import { batch } from '@domain/state/batch';
import type { IndividualSimHost } from '@features/sim_host';
import type { Class, EquipmentSpec, Glyphs, Profession, Race } from '@generated/proto/common';
import Toast from '@ui-kit/toast';

/** One parsed character, in the shape every individual importer produces. */
export interface IndividualImport {
	charClass: Class;
	race: Race;
	equipmentSpec: EquipmentSpec;
	talentsStr: string;
	glyphs: Glyphs | null;
	professions: Profession[];
	missingEnchants?: number[];
	missingItems?: number[];
}

/**
 * The tail every individual importer shares: check the class, fill in whatever items the database
 * has not loaded yet, apply the character in one batch, and say what was missing.
 *
 * It was `IndividualImporter.finishIndividualImport`, a protected method that also closed the modal.
 * Closing belongs to the dialog now — the `Importer` shell closes when `onImport` resolves — so this
 * is only the work, and the class mismatch it can throw reaches the shell's error toast.
 *
 * **That last part is a fix, not a port.** All three vanilla callers invoked this without `await`,
 * so a "Wrong Class!" rejection was unhandled: importing a mage export on a warrior page changed
 * nothing and told the user nothing.
 */
export const finishIndividualImport = async (
	host: IndividualSimHost<any>,
	{ charClass, race, equipmentSpec, talentsStr, glyphs, professions, missingEnchants = [], missingItems = [] }: IndividualImport,
): Promise<void> => {
	if (charClass != host.player.getClass()) {
		throw new Error(`Wrong Class! Expected ${host.player.getPlayerClass().friendlyName} but found ${classNames.get(charClass)}!`);
	}

	await Database.loadLeftoversIfNecessary(equipmentSpec);

	const gear = host.sim.db.lookupEquipmentSpec(equipmentSpec);

	// Now update settings using the parsed values.
	batch(() => {
		host.player.setRace(race);
		host.player.setGear(gear);
		if (talentsStr && talentsStr != '--') {
			host.player.setTalentsString(talentsStr);
		}
		if (glyphs) {
			host.player.setGlyphs(glyphs);
		}
		if (professions.length > 0) {
			host.player.setProfessions(professions);
		}
	});

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
};
