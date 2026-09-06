import { Database } from '@domain/proto_utils/database';
import { nameToClass, nameToProfession, nameToRace } from '@domain/proto_utils/names';
import type { GlyphConfig } from '@domain/talents/config';
import { classGlyphsConfig } from '@domain/talents/factory';
import { Class, EquipmentSpec, Glyphs, Profession, Race } from '@generated/proto/common';
import i18n from '@i18n/config';
import type { JsonObject } from '@protobuf-ts/runtime';
import Toast from '@ui-kit/toast';

import { finishIndividualImport } from './finish_individual_import';
import type { ImporterDefinition } from './types';

function glyphNameToID(glyphName: string, glyphsConfig: Record<number, GlyphConfig>): number {
	if (!glyphName) {
		return 0;
	}

	for (const glyphIDStr in glyphsConfig) {
		if (glyphsConfig[glyphIDStr].name == glyphName) {
			return parseInt(glyphIDStr);
		}
	}
	throw new Error(`Unknown glyph name '${glyphName}'`);
}

export function glyphToID(glyph: string | JsonObject, db: Database, glyphsConfig: Record<number, GlyphConfig>): number {
	if (typeof glyph === 'string') {
		// Legacy version: AddOn exports Glyphs by name (string) only. Names must be in English.
		return glyphNameToID(glyph, glyphsConfig);
	}

	// Cata version exports glyph information in a table that includes the name and the glyph spell ID.
	return db.glyphSpellToItemId(glyph.spellID as number);
}

function getWSEVersion(): Promise<string | null> {
	return fetch('https://api.github.com/repos/wowsims/exporter/releases/latest')
		.then(resp => {
			return resp.json().then(json => {
				return json.tag_name as string;
			});
		})
		.catch(_ => {
			return null;
		});
}

const WSE_VERSION = getWSEVersion();

export const ADDON_IMPORTER: ImporterDefinition = {
	title: i18n.t('import.addon.title'),
	allowFileUpload: true,
	onImport: async (host, data) => {
		let importJson: any | null;
		try {
			importJson = JSON.parse(data);
		} catch {
			throw new Error('Please use a valid Addon export.');
		}

		const addonVersion = await WSE_VERSION;
		if (addonVersion && ((importJson['version'] as string) || '') != addonVersion) {
			new Toast({ variant: 'warning', body: `Addon is not up to date. Addon version : '${importJson['version']}', Latest version : '${addonVersion}'` });
		}

		// Parse all the settings.
		const charClass = nameToClass((importJson['class'] as string) || '');
		if (charClass == Class.ClassUnknown) {
			throw new Error('Could not parse Class!');
		}

		const race = nameToRace((importJson['race'] as string) || '');
		if (race == Race.RaceUnknown) {
			throw new Error('Could not parse Race!');
		}

		const professions = (importJson['professions'] as Array<{ name: string; level: number }>).map(profData => nameToProfession(profData.name));
		professions.forEach((prof, i) => {
			if (prof == Profession.ProfessionUnknown) {
				throw new Error(`Could not parse profession '${importJson['professions'][i]}'`);
			}
		});

		const talentsStr = (importJson['talents'] as string) || '';
		const glyphsConfig = classGlyphsConfig[charClass];

		const db = await Database.get();
		const majorGlyphIDs = (importJson['glyphs']['major'] as Array<string | JsonObject>).map(g => glyphToID(g, db, glyphsConfig.majorGlyphs));
		const minorGlyphIDs = (importJson['glyphs']['minor'] as Array<string | JsonObject>).map(g => glyphToID(g, db, glyphsConfig.minorGlyphs));

		const glyphs = Glyphs.create({
			major1: majorGlyphIDs[0] || 0,
			major2: majorGlyphIDs[1] || 0,
			major3: majorGlyphIDs[2] || 0,
			minor1: minorGlyphIDs[0] || 0,
			minor2: minorGlyphIDs[1] || 0,
			minor3: minorGlyphIDs[2] || 0,
		});

		const gearJson = importJson['gear'];
		gearJson.items = (gearJson.items as Array<any>).filter(item => item != null);
		delete gearJson.version;

		(gearJson.items as Array<any>).forEach(item => {
			if (item.gems) {
				item.gems = (item.gems as Array<any>).map(gem => gem || 0);
			}
		});
		const equipmentSpec = EquipmentSpec.fromJson(gearJson);

		await finishIndividualImport(host, {
			charClass,
			race,
			equipmentSpec,
			talentsStr,
			glyphs,
			professions,
		});
	},
};
