/** @jsxImportSource @jsx-vanilla */
import { BulkSimItemSlot } from '@domain/bulk/utils';
import { LaunchStatus } from '@domain/constants/other';
import { PresetConfigurationCategory } from '@domain/constants/preset_categories';
import { PlayerClass } from '@domain/player_class';
import { PlayerSpec } from '@domain/player_spec';
import { resourceNames } from '@domain/proto_utils/names';
import { ArmorType, ItemSlot, MobType, Profession, PseudoStat, Race, RangedWeaponType, Spec, SpellSchool, Stat, WeaponType } from '@generated/proto/common';
import { ResourceType } from '@generated/proto/spell';
import { RaidFilterOption, SourceFilterOption } from '@generated/proto/ui';

import i18n from './config';
import {
	aplItemLabelI18nKeys,
	backendMetricI18nKeys as resultMetricI18nKeys,
	classNameToClassKey,
	getArmorTypeI18nKey,
	getBulkSlotI18nKey,
	getClassI18nKey,
	getMasterySpellNameI18nKey,
	getMobTypeI18nKey,
	getPresetConfigurationCategoryI18nKey,
	getProfessionI18nKey,
	getRaceI18nKey,
	getRaidFilterI18nKey,
	getRangedWeaponTypeI18nKey,
	getSlotNameI18nKey,
	getSourceFilterI18nKey,
	getSpecI18nKey,
	getStatusI18nKey,
	getTargetInputI18nKey,
	getWeaponTypeI18nKey,
	protoStatNameI18nKeys,
	pseudoStatI18nKeys,
	resourceTypeI18nKeys,
	spellSchoolI18nKeys,
	statI18nKeys,
} from './entity_mapping';
import { getLang, setLang, supportedLanguages } from './locale_service';

/**
 * Entity translation functions
 */

export const translateStat = (stat: Stat): string => {
	return i18n.t(`common.stats.${statI18nKeys[stat] || Stat[stat].toLowerCase()}`, {
		defaultValue: Stat[stat],
	});
};
export const translateProtoStatName = (statName: string): string => {
	return i18n.t(`common.stats.${protoStatNameI18nKeys[statName] || statName.toLowerCase()}`, {
		defaultValue: statName,
	});
};

export const translatePseudoStat = (pseudoStat: PseudoStat): string => {
	return i18n.t(`common.stats.${pseudoStatI18nKeys[pseudoStat] || PseudoStat[pseudoStat].toLowerCase()}`, {
		defaultValue: PseudoStat[pseudoStat],
	});
};

// Target Inputs are fetched from proto, so we need to translate the label and tooltip
// Currently it is TBD if we will translate Golang texts, let's keep it for now

export const translateTargetInputLabel = (label: string): string => {
	return i18n.t(`settings_tab.encounter.target_inputs.${getTargetInputI18nKey(label)}.label`, {
		defaultValue: label,
	});
};

export const translateTargetInputTooltip = (label: string, tooltip: string): string => {
	return i18n.t(`settings_tab.encounter.target_inputs.${getTargetInputI18nKey(label)}.tooltip`, {
		defaultValue: tooltip,
	});
};

export const translateSpellSchool = (spellSchool: SpellSchool): string => {
	return i18n.t(`common.spell_schools.${spellSchoolI18nKeys[spellSchool] || SpellSchool[spellSchool].toLowerCase()}`, {
		defaultValue: SpellSchool[spellSchool],
	});
};

export const translateMobType = (mobType: MobType): string => {
	return i18n.t(`common.mob_types.${getMobTypeI18nKey(mobType)}`, {
		defaultValue: MobType[mobType],
	});
};

export const translateRace = (race: Race): string => {
	return i18n.t(`races.${getRaceI18nKey(race)}`, { ns: 'character', defaultValue: Race[race] });
};

export const translateProfession = (profession: Profession): string => {
	return i18n.t(`professions.${getProfessionI18nKey(profession)}`, { ns: 'character', defaultValue: Profession[profession] });
};

export const translateSourceFilter = (source: SourceFilterOption): string => {
	return i18n.t(`common.sources.${getSourceFilterI18nKey(source)}`, {
		defaultValue: SourceFilterOption[source],
	});
};

export const translateRaidFilter = (raid: RaidFilterOption): string => {
	return i18n.t(`common.raids.${getRaidFilterI18nKey(raid)}`, {
		defaultValue: RaidFilterOption[raid],
	});
};

export const translateArmorType = (armorType: ArmorType): string => {
	return i18n.t(`common.armor_types.${getArmorTypeI18nKey(armorType)}`, {
		defaultValue: ArmorType[armorType],
	});
};

export const translateWeaponType = (weaponType: WeaponType): string => {
	return i18n.t(`common.weapon_types.${getWeaponTypeI18nKey(weaponType)}`, {
		defaultValue: WeaponType[weaponType],
	});
};

export const translateRangedWeaponType = (rangedWeaponType: RangedWeaponType): string => {
	return i18n.t(`common.ranged_weapon_types.${getRangedWeaponTypeI18nKey(rangedWeaponType)}`, {
		defaultValue: RangedWeaponType[rangedWeaponType],
	});
};

export const translateResourceType = (resourceType: ResourceType): string => {
	return i18n.t(`common.resource_types.${resourceTypeI18nKeys[resourceType] || ResourceType[resourceType].toLowerCase()}`, {
		defaultValue: resourceNames.get(resourceType),
	});
};

export const translateMasterySpellName = (spec: Spec): string => {
	return i18n.t(`common.mastery_spell_names.${getMasterySpellNameI18nKey(spec)}`, {
		defaultValue: Spec[spec],
	});
};

export const translateStatus = (status: LaunchStatus): string => {
	return i18n.t(`common.status.${getStatusI18nKey(status)}`, {
		defaultValue: LaunchStatus[status],
	});
};

export const translateClass = (className: string): string => {
	return i18n.t(`classes.${classNameToClassKey(className)}`, {
		ns: 'character',
		defaultValue: className,
	});
};

export const translateSpec = (className: string, specName: string): string => {
	const specKey = specName.toLowerCase();
	return i18n.t(`specs.${classNameToClassKey(className)}.${specKey}`, {
		ns: 'character',
		defaultValue: specName,
	});
};

export const translatePlayerClass = (playerClass: PlayerClass<any>): string => {
	return translateClass(getClassI18nKey(playerClass.classID));
};

export const translatePlayerSpec = (playerSpec: PlayerSpec<any>): string => {
	return translateSpec(getClassI18nKey(playerSpec.classID), getSpecI18nKey(playerSpec.specID));
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

// The spec page template is identical for every spec (see ui/index_template.html),
// so class/spec are no longer baked in as data-class/data-spec attributes; derive
// them from the URL the same way ui/app/spec_entry.ts derives its spec module key
// ('/mop/warrior/arms/' -> ['warrior', 'arms']). Data attributes are kept as a
// fallback for any caller that isn't served from a real spec URL.
export const extractClassAndSpecFromDataAttributes = (): { className: string; specName: string } | null => {
	const base = import.meta.env.BASE_URL || '/';
	const rel = (location.pathname.startsWith(base) ? location.pathname.slice(base.length) : location.pathname)
		.replace(/^\/+/, '')
		.replace(/index\.html$/, '')
		.replace(/\/+$/, '');
	const [className, specName] = rel.split('/');
	if (className && specName) {
		return { className, specName };
	}

	const titleElement = document.querySelector('title');
	if (titleElement) {
		const attrClassName = titleElement.getAttribute('data-class');
		const attrSpecName = titleElement.getAttribute('data-spec');
		if (attrClassName && attrSpecName) {
			return { className: attrClassName, specName: attrSpecName };
		}
	}

	const metaDescription = document.querySelector('meta[name="description"]') as HTMLMetaElement;
	if (metaDescription) {
		const attrClassName = metaDescription.getAttribute('data-class');
		const attrSpecName = metaDescription.getAttribute('data-spec');
		if (attrClassName && attrSpecName) {
			return { className: attrClassName, specName: attrSpecName };
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
			const text = i18n.t(key, { ns: ns || undefined });
			// The landing page tags its `<meta name="description">` with data-i18n, and a meta
			// element carries its text in `content`, not as a child text node.
			if (element instanceof HTMLMetaElement) {
				element.setAttribute('content', text);
			} else {
				element.textContent = text;
			}
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
	// A <meta>'s text is its `content` attribute; `textContent` on it is invisible to crawlers.
	document.querySelector('meta[name="description"]')?.setAttribute('content', i18n.t('sim.description', translationData));
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

	return i18n.t(`sidebar.results.metrics.${key}.label`, {
		defaultValue: metricName,
	});
};

export const translateResultMetricTooltip = (metricName: string): string => {
	const cleanName = metricName.replace(/[O0]$/, '');
	const key = resultMetricI18nKeys[cleanName] || resultMetricI18nKeys[metricName];
	if (!key) return metricName;

	const tooltipKey = key === 'tmi' || key === 'cod' ? `${key}.tooltip.title` : `${key}.tooltip`;
	return i18n.t(`sidebar.results.metrics.${tooltipKey}`, {
		defaultValue: metricName,
	});
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
	return i18n.t(`common.preset.${getPresetConfigurationCategoryI18nKey(category)}`, {
		defaultValue: category,
	});
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
		options || (extractClassAndSpecFromDataAttributes() ? { updateSimMetadata: true } : { updateSimLinks: true, updateLanguageDropdown: true });

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
