import { JsonObject } from '@protobuf-ts/runtime';
import { ref } from 'tsx-vanilla';

import { IndividualSimUI } from '../../../individual_sim_ui';
import { Class, EquipmentSpec, Glyphs, Profession, Race, Spec } from '../../../proto/common';
import { Database } from '../../../proto_utils/database';
import { nameToClass, nameToProfession, nameToRace } from '../../../proto_utils/names';
import { classGlyphsConfig } from '../../../talents/factory';
import { GlyphConfig } from '../../../talents/glyphs_picker';
import Toast from '../../toast';
import { IndividualImporter } from './individual_importer';
import i18n from '../../../../i18n/config';

export class IndividualAddonImporter<SpecType extends Spec> extends IndividualImporter<SpecType> {
	static WSE_VERSION = getWSEVersion();
	constructor(parent: HTMLElement, simUI: IndividualSimUI<SpecType>) {
		super(parent, simUI, { title: i18n.t('import.addon.title'), allowFileUpload: true });

		const warningRef = ref<HTMLDivElement>();
		this.descriptionElem.appendChild(
			<div>
				<p>
					{i18n.t('import.addon.description')}{' '}
					<a href="https://www.curseforge.com/wow/addons/wowsimsexporter" target="_blank">
						{i18n.t('import.addon.addon_link')}
					</a>
					.
				</p>
				<p>{i18n.t('import.addon.feature_description')}</p>
				<p>{i18n.t('import.addon.instructions')}</p>
				<div ref={warningRef} />
			</div>
		);

		if (warningRef.value)
			new Toast({
				title: i18n.t('import.addon.reforge_warning.title'),
				body: (
					<div>
						{i18n.t('import.addon.reforge_warning.message')}
					</div>
				),
				additionalClasses: ['toast-import-warning'],
				container: warningRef.value,
				variant: 'warning',
				canClose: false,
				autoShow: true,
				autohide: false,
			});
	}

	async onImport(data: string) {
		let importJson: any | null;
		try {
			importJson = JSON.parse(data);
		} catch {
			throw new Error('Please use a valid Addon export.');
		}

		let addonVersion = await IndividualAddonImporter.WSE_VERSION;
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

		this.finishIndividualImport(this.simUI, {
			charClass,
			race,
			equipmentSpec,
			talentsStr,
			glyphs,
			professions,
		});
	}
}

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

function glyphToID(glyph: string | JsonObject, db: Database, glyphsConfig: Record<number, GlyphConfig>): number {
	if (typeof glyph === 'string') {
		// Legacy version: AddOn exports Glyphs by name (string) only. Names must be in English.
		return glyphNameToID(glyph, glyphsConfig);
	}

	// Cata version exports glyph information in a table that includes the name and the glyph spell ID.
	return db.glyphSpellToItemId(glyph.spellID as number);
}

function getWSEVersion(): Promise<string|null> {
	return fetch('https://api.github.com/repos/wowsims/exporter/releases/latest')
		.then(resp => {
			return resp.json().then(json => {
				return json.tag_name as string;
			})
		})
		.catch(_ => {
			return null;
		})
}