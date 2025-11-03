import { PlayerClass } from '../core/player_class';
import { PlayerSpec } from '../core/player_spec';
import { ArmorType, Class, MobType, PseudoStat, Race, Profession, SpellSchool, Stat, WeaponType, RangedWeaponType, Spec, ItemSlot } from '../core/proto/common';
import { ResourceType } from '../core/proto/spell';
import { RaidFilterOption, SourceFilterOption } from '../core/proto/ui';
import { LaunchStatus } from '../core/launched_sims';
import { BulkSimItemSlot } from '../core/components/individual_sim_ui/bulk/utils';
import { PresetConfigurationCategory } from '../core/components/individual_sim_ui/preset_configuration_picker';
import i18n from './config';
import {
	getClassI18nKey,
	getMobTypeI18nKey,
	getRaceI18nKey,
	getProfessionI18nKey,
	getSpecI18nKey,
	getTargetInputI18nKey,
	pseudoStatI18nKeys,
	spellSchoolI18nKeys,
	statI18nKeys,
	getSourceFilterI18nKey,
	getRaidFilterI18nKey,
	getArmorTypeI18nKey,
	getWeaponTypeI18nKey,
	getRangedWeaponTypeI18nKey,
	getMasterySpellNameI18nKey,
	aplItemLabelI18nKeys,
	backendMetricI18nKeys as resultMetricI18nKeys,
	resourceTypeI18nKeys,
	getStatusI18nKey,
	getSlotNameI18nKey,
	protoStatNameI18nKeys,
	getBulkSlotI18nKey,
	getPresetConfigurationCategoryI18nKey,
} from './entity_mapping';
import { getLang, setLang, supportedLanguages } from './locale_service';

/**
 * Entity translation functions
 */

export const translateStat = (stat: Stat): string => {
	try {
		const key = statI18nKeys[stat] || Stat[stat].toLowerCase();
		const translated = i18n.t(`common.stats.${key}`);
		if (translated === `common.stats.${key}`) {
			return Stat[stat];
		}
		return translated;
	} catch {
		return Stat[stat];
	}
};
export const translateProtoStatName = (statName: string): string => {
	try {
		const key = protoStatNameI18nKeys[statName] || statName.toLowerCase();
		const translated = i18n.t(`common.stats.${key}`);
		if (translated === `common.stats.${key}`) {
			return statName;
		}
		return translated;
	} catch {
		return statName;
	}
};

export const translatePseudoStat = (pseudoStat: PseudoStat): string => {
	try {
		const key = pseudoStatI18nKeys[pseudoStat] || PseudoStat[pseudoStat].toLowerCase();
		const translated = i18n.t(`common.stats.${key}`);
		if (translated === `common.stats.${key}`) {
			return PseudoStat[pseudoStat];
		}
		return translated;
	} catch {
		return PseudoStat[pseudoStat];
	}
};

// Target Inputs are fetched from proto, so we need to translate the label and tooltip
// Currently it is TBD if we will translate Golang texts, let's keep it for now

export const translateTargetInputLabel = (label: string): string => {
	try {
		const key = getTargetInputI18nKey(label);
		const translated = i18n.t(`settings_tab.encounter.target_inputs.${key}.label`);
		if (translated === `settings.encounter.target_inputs.${key}.label`) {
			return label;
		}
		return translated;
	} catch {
		return label;
	}
};

export const translateTargetInputTooltip = (label: string, tooltip: string): string => {
	try {
		const key = getTargetInputI18nKey(label);
		const translated = i18n.t(`settings_tab.encounter.target_inputs.${key}.tooltip`);
		if (translated === `settings.encounter.target_inputs.${key}.tooltip`) {
			return tooltip;
		}
		return translated;
	} catch {
		return tooltip;
	}
};

export const translateSpellSchool = (spellSchool: SpellSchool): string => {
	try {
		const key = spellSchoolI18nKeys[spellSchool] || SpellSchool[spellSchool].toLowerCase();
		const translated = i18n.t(`common.spell_schools.${key}`);
		if (translated === `common.spell_schools.${key}`) {
			return SpellSchool[spellSchool];
		}
		return translated;
	} catch {
		return SpellSchool[spellSchool];
	}
};

export const translateMobType = (mobType: MobType): string => {
	try {
		const key = getMobTypeI18nKey(mobType);
		const translated = i18n.t(`common.mob_types.${key}`);
		if (translated === `common.mob_types.${key}`) {
			return MobType[mobType];
		}
		return translated;
	} catch {
		return MobType[mobType];
	}
};

export const translateRace = (race: Race): string => {
	try {
		const key = getRaceI18nKey(race);
		const translated = i18n.t(`races.${key}`, { ns: 'character' });
		if (translated === `races.${key}`) {
			return Race[race];
		}
		return translated;
	} catch {
		return Race[race];
	}
};

export const translateProfession = (profession: Profession): string => {
	try {
		const key = getProfessionI18nKey(profession);
		const translated = i18n.t(`professions.${key}`, { ns: 'character' });
		if (translated === `professions.${key}`) {
			return Profession[profession];
		}
		return translated;
	} catch {
		return Profession[profession];
	}
};

export const translateSourceFilter = (source: SourceFilterOption): string => {
	try {
		const key = getSourceFilterI18nKey(source);
		const translated = i18n.t(`common.sources.${key}`);
		if (translated === `common.sources.${key}`) {
			return SourceFilterOption[source];
		}
		return translated;
	} catch {
		return SourceFilterOption[source];
	}
};

export const translateRaidFilter = (raid: RaidFilterOption): string => {
	try {
		const key = getRaidFilterI18nKey(raid);
		const translated = i18n.t(`common.raids.${key}`);
		if (translated === `common.raids.${key}`) {
			return RaidFilterOption[raid];
		}
		return translated;
	} catch {
		return RaidFilterOption[raid];
	}
};

export const translateArmorType = (armorType: ArmorType): string => {
	try {
		const key = getArmorTypeI18nKey(armorType);
		const translated = i18n.t(`common.armor_types.${key}`);
		if (translated === `common.armor_types.${key}`) {
			return ArmorType[armorType];
		}
		return translated;
	} catch {
		return ArmorType[armorType];
	}
};

export const translateWeaponType = (weaponType: WeaponType): string => {
	try {
		const key = getWeaponTypeI18nKey(weaponType);
		const translated = i18n.t(`common.weapon_types.${key}`);
		if (translated === `common.weapon_types.${key}`) {
			return WeaponType[weaponType];
		}
		return translated;
	} catch {
		return WeaponType[weaponType];
	}
};

export const translateRangedWeaponType = (rangedWeaponType: RangedWeaponType): string => {
	try {
		const key = getRangedWeaponTypeI18nKey(rangedWeaponType);
		const translated = i18n.t(`common.ranged_weapon_types.${key}`);
		if (translated === `common.ranged_weapon_types.${key}`) {
			return RangedWeaponType[rangedWeaponType];
		}
		return translated;
	} catch {
		return RangedWeaponType[rangedWeaponType];
	}
};

export const translateResourceType = (resourceType: ResourceType): string => {
	try {
		const key = resourceTypeI18nKeys[resourceType] || ResourceType[resourceType].toLowerCase();
		const translated = i18n.t(`common.resource_types.${key}`);
		if (translated === `common.resource_types.${key}`) {
			return ResourceType[resourceType];
		}
		return translated;
	} catch {
		return ResourceType[resourceType];
	}
};

export const translateMasterySpellName = (spec: Spec): string => {
	try {
		const key = getMasterySpellNameI18nKey(spec);
		const translated = i18n.t(`common.mastery_spell_names.${key}`);
		if (translated === `common.mastery_spell_names.${key}`) {
			return Spec[spec];
		}
		return translated;
	} catch {
		return Spec[spec];
	}
};

export const translateStatus = (status: LaunchStatus): string => {
	try {
		const key = getStatusI18nKey(status);
		const translated = i18n.t(`common.status.${key}`);
		if (translated === `common.status.${key}`) {
			return LaunchStatus[status];
		}
		return translated;
	} catch {
		return LaunchStatus[status];
	}
};

export const translateClass = (className: string): string => {
	try {
		const normalizedClassName = className.toLowerCase().replace(/_/g, '');
		const i18nKey = normalizedClassName === 'deathknight' ? 'death_knight' : normalizedClassName;
		const translated = i18n.t(`classes.${i18nKey}`, { ns: 'character' });
		if (translated === `classes.${i18nKey}`) {
			return className;
		}
		return translated;
	} catch {
		return className;
	}
};

export const translateSpec = (className: string, specName: string): string => {
	try {
		const normalizedClassName = className.toLowerCase().replace(/_/g, '');
		const classKey = normalizedClassName === 'deathknight' ? 'death_knight' : normalizedClassName;
		const specKey = specName.toLowerCase();
		const translated = i18n.t(`specs.${classKey}.${specKey}`, { ns: 'character' });
		if (translated === `specs.${classKey}.${specKey}`) {
			return specName;
		}
		return translated;
	} catch {
		return specName;
	}
};

export const translatePlayerClass = (playerClass: PlayerClass<any>): string => {
	const classKey = getClassI18nKey(playerClass.classID);
	return translateClass(classKey);
};

export const translatePlayerSpec = (playerSpec: PlayerSpec<any>): string => {
	const classKey = getClassI18nKey(playerSpec.classID);
	const specKey = getSpecI18nKey(playerSpec.specID);
	return translateSpec(classKey, specKey);
};

/**
 * Component Translation Helpers
 */

export const extractClassAndSpecFromLink = (link: HTMLAnchorElement): { className?: string; specName?: string } => {
	const parts = link.pathname.split('/').filter(Boolean);
	if (parts.length >= 2) {
		return {
			className: parts[1],
			specName: parts[2],
		};
	}
	return {};
};

export const extractClassAndSpecFromDataAttributes = (): { className: string; specName: string } | null => {
	const titleElement = document.querySelector('title');
	if (titleElement) {
		const className = titleElement.getAttribute('data-class');
		const specName = titleElement.getAttribute('data-spec');
		if (className && specName) {
			return { className, specName };
		}
	}

	const metaDescription = document.querySelector('meta[name="description"]') as HTMLMetaElement;
	if (metaDescription) {
		const className = metaDescription.getAttribute('data-class');
		const specName = metaDescription.getAttribute('data-spec');
		if (className && specName) {
			return { className, specName };
		}
	}
	return null;
};

export const updateLanguageDropdown = (): void => {
	const dropdownMenu = document.querySelector('.dropdown-menu[aria-labelledby="languageDropdown"]');
	if (!dropdownMenu) return;

	const currentLang = getLang();
	dropdownMenu.innerHTML = '';

	Object.entries(supportedLanguages).forEach(([code, name]) => {
		const handleClick = (e: Event) => {
			e.preventDefault();
			setLang(code);
			window.location.reload();
		};

		const languageItem = (
			<li>
				<a className={`dropdown-item ${code === currentLang ? 'active' : ''}`} href="#" data-lang={code} onclick={handleClick}>
					{name}
				</a>
			</li>
		);

		dropdownMenu.appendChild(languageItem);
	});
};

export const updateDataI18nElements = (): void => {
	document.querySelectorAll('[data-i18n]').forEach(element => {
		const key = element.getAttribute('data-i18n');
		const ns = element.getAttribute('data-i18n-ns');
		if (key) {
			element.textContent = i18n.t(key, { ns: ns || undefined });
		}
	});
};

export const updateSimPageMetadata = (): void => {
	const classSpecInfo = extractClassAndSpecFromDataAttributes();
	if (!classSpecInfo) return;

	const { className, specName } = classSpecInfo;

	const translationData = {
		class: translateClass(className),
		spec: translateSpec(className, specName),
	};

	document.querySelector('title')!.textContent = i18n.t('sim.title', translationData);
	document.querySelector('meta[name="description"]')!.textContent = i18n.t('sim.description', translationData);
};

export const updateSimLinks = (): void => {
	document.querySelectorAll('.sim-link-content').forEach(content => {
		const classLabel = content.querySelector('.sim-link-label');
		const specTitle = content.querySelector('.sim-link-title');
		const link = content.closest('a');

		if (classLabel && specTitle && link instanceof HTMLAnchorElement) {
			const info = extractClassAndSpecFromLink(link);
			if (info && info.className && info.specName) {
				classLabel.textContent = translateClass(info.className);
				specTitle.textContent = translateSpec(info.className, info.specName);
			}
		} else if (specTitle && link instanceof HTMLAnchorElement) {
			const info = extractClassAndSpecFromLink(link);
			if (info && info.className) {
				specTitle.textContent = translateClass(info.className);
			}
		}
	});
};

export const translateItemLabel = (itemLabel: string): string => {
	try {
		const key = aplItemLabelI18nKeys[itemLabel];
		if (!key) {
			return itemLabel;
		}
		const translated = i18n.t(key);
		if (translated === key) {
			return itemLabel;
		}
		return translated;
	} catch {
		return itemLabel;
	}
};

export const translateResultMetricLabel = (metricName: string): string => {
	const cleanName = metricName.replace(/[O0]$/, '');
	const key = resultMetricI18nKeys[cleanName] || resultMetricI18nKeys[metricName];
	if (!key) return metricName;

	const translated = i18n.t(`sidebar.results.metrics.${key}.label`);
	return translated === `sidebar.results.metrics.${key}.label` ? metricName : translated;
};

export const translateResultMetricTooltip = (metricName: string): string => {
	const cleanName = metricName.replace(/[O0]$/, '');
	const key = resultMetricI18nKeys[cleanName] || resultMetricI18nKeys[metricName];
	if (!key) return metricName;

	const tooltipKey = key === 'tmi' || key === 'cod' ? `${key}.tooltip.title` : `${key}.tooltip`;
	const translated = i18n.t(`sidebar.results.metrics.${tooltipKey}`);
	return translated === `sidebar.results.metrics.${tooltipKey}` ? metricName : translated;
};

export const translateSlotName = (slot: ItemSlot): string => {
	const key = getSlotNameI18nKey(slot);
	return i18n.t(`slots.${key}`, { ns: 'character' });
};

export const translateBulkSlotName = (slot: BulkSimItemSlot): string => {
	const key = getBulkSlotI18nKey(slot);
	return i18n.t(`slots.${key}`, { ns: 'character' });
};

export const translatePresetConfigurationCategory = (category: PresetConfigurationCategory): string => {
	try {
		const key = getPresetConfigurationCategoryI18nKey(category);
		const translated = i18n.t(`common.preset.${key}`);
		if (translated === `common.preset.${key}`) {
			return category;
		}
		return translated;
	} catch {
		return category;
	}
};

/**
 * Localization Initialization
 */

export interface LocalizationOptions {
	updateSimMetadata?: boolean;
	updateSimLinks?: boolean;
	updateLanguageDropdown?: boolean;
}

export const updateTranslations = (options: LocalizationOptions = {}): void => {
	document.documentElement.lang = getLang();
	updateDataI18nElements();

	if (options.updateSimMetadata) {
		updateSimPageMetadata();
	}

	if (options.updateSimLinks) {
		updateSimLinks();
	}

	if (options.updateLanguageDropdown) {
		updateLanguageDropdown();
	}
};

export const initLocalization = (options?: LocalizationOptions): void => {
	const finalOptions =
		options ||
		(document.querySelector('title[data-class]') || document.querySelector('meta[data-class]')
			? { updateSimMetadata: true }
			: { updateSimLinks: true, updateLanguageDropdown: true });

	const initialize = () => {
		if (!i18n.isInitialized) {
			i18n.init();
		}

		i18n.on('languageChanged', () => {
			updateTranslations(finalOptions);
		});

		updateTranslations(finalOptions);
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize);
	} else {
		initialize();
	}
};
