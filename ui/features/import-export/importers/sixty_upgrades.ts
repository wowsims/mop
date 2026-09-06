import { nameToClass, nameToRace } from '@domain/proto_utils/names';
import { talentSpellIdsToTalentString } from '@domain/talents/factory';
import { Class, EquipmentSpec, ItemSpec, Race } from '@generated/proto/common';
import Toast from '@ui-kit/toast';

import { finishIndividualImport } from './finish_individual_import';
import type { ImporterDefinition } from './types';

/** `<p>…</p><ul><li><strong>name</strong></li>…</ul>`, which is what the vanilla JSX built. */
const removedSuffixesBody = (itemNames: string[]): HTMLElement => {
	const body = document.createElement('div');
	const lead = document.createElement('p');
	lead.textContent = 'Sixty Upgrades currently exports the wrong Random Suffixes. We have removed the random suffix on the following item(s):';
	const list = document.createElement('ul');
	for (const itemName of itemNames) {
		const item = document.createElement('li');
		const name = document.createElement('strong');
		name.textContent = itemName;
		item.appendChild(name);
		list.appendChild(item);
	}
	body.append(lead, list);
	return body;
};

export const SIXTY_UPGRADES_IMPORTER: ImporterDefinition = {
	title: 'Sixty Upgrades Cataclysm Import',
	allowFileUpload: true,
	onImport: async (host, data) => {
		let importJson: any | null;
		try {
			importJson = JSON.parse(data);
		} catch {
			throw new Error('Please use a valid Sixty Upgrades export.');
		}

		// Parse all the settings.
		const charClass = nameToClass((importJson?.character?.gameClass as string) || '');
		if (charClass == Class.ClassUnknown) {
			throw new Error('Could not parse Class!');
		}

		const race = nameToRace((importJson?.character?.race as string) || '');
		if (race == Race.RaceUnknown) {
			throw new Error('Could not parse Race!');
		}

		let talentsStr = '';
		if (importJson?.talents?.length > 0) {
			const talentIds = (importJson.talents as Array<any>).map(talentJson => talentJson.spellId);
			talentsStr = talentSpellIdsToTalentString(charClass, talentIds);
		}

		let hasRemovedRandomSuffix = false;
		const modifiedItemNames: string[] = [];
		const equipmentSpec = EquipmentSpec.create();
		(importJson.items as Array<any>).forEach(itemJson => {
			const itemSpec = ItemSpec.create();
			itemSpec.id = itemJson.id;
			if (itemJson.enchant?.id) {
				itemSpec.enchant = itemJson.enchant.id;
			}
			if (itemJson.gems) {
				itemSpec.gems = (itemJson.gems as Array<any>).filter(gemJson => gemJson?.id).map(gemJson => gemJson.id);
			}

			// As long as 60U exports the wrong suffixes we should
			// inform the user that they need to manually add them.
			// Due to this we also remove the reforge on the item.
			if (itemJson.suffixId) {
				hasRemovedRandomSuffix = true;
				if (itemJson.reforge?.id) {
					itemJson.reforge.id = null;
				}
				modifiedItemNames.push(itemJson.name);
			}
			if (itemJson.reforge?.id) {
				itemSpec.reforging = itemJson.reforge.id;
			}
			equipmentSpec.items.push(itemSpec);
		});

		// The vanilla importer called `sim.db.lookupEquipmentSpec(equipmentSpec)` here and threw the
		// result away; `finishIndividualImport` calls it again for the gear it actually applies.

		await finishIndividualImport(host, {
			charClass,
			race,
			equipmentSpec,
			talentsStr,
			glyphs: null,
			professions: [],
		});

		if (hasRemovedRandomSuffix && modifiedItemNames.length) {
			new Toast({ variant: 'warning', body: removedSuffixesBody(modifiedItemNames), delay: 8000 });
		}
	},
};
