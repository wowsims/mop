import { PlayerClass } from '../core/player_class';
import { PlayerSpec } from '../core/player_spec';
import { Class, Spec } from '../core/proto/common';
import i18n from './config';
import { getLang, setLang, supportedLanguages } from './locale_service';

// Helper function to convert Class enum to string for translation keys
const classEnumToString = (classID: Class): string => {
	switch (classID) {
		case Class.ClassDeathKnight: return 'death_knight';
		case Class.ClassDruid: return 'druid';
		case Class.ClassHunter: return 'hunter';
		case Class.ClassMage: return 'mage';
		case Class.ClassMonk: return 'monk';
		case Class.ClassPaladin: return 'paladin';
		case Class.ClassPriest: return 'priest';
		case Class.ClassRogue: return 'rogue';
		case Class.ClassShaman: return 'shaman';
		case Class.ClassWarlock: return 'warlock';
		case Class.ClassWarrior: return 'warrior';
		default: return 'unknown';
	}
};

// Helper function to convert Spec enum to string for translation keys
const specEnumToString = (specID: Spec): string => {
	switch (specID) {
		// Death Knight
		case Spec.SpecBloodDeathKnight: return 'blood';
		case Spec.SpecFrostDeathKnight: return 'frost';
		case Spec.SpecUnholyDeathKnight: return 'unholy';
		// Druid
		case Spec.SpecBalanceDruid: return 'balance';
		case Spec.SpecFeralDruid: return 'feral';
		case Spec.SpecGuardianDruid: return 'guardian';
		case Spec.SpecRestorationDruid: return 'restoration';
		// Hunter
		case Spec.SpecBeastMasteryHunter: return 'beast_mastery';
		case Spec.SpecMarksmanshipHunter: return 'marksmanship';
		case Spec.SpecSurvivalHunter: return 'survival';
		// Mage
		case Spec.SpecArcaneMage: return 'arcane';
		case Spec.SpecFireMage: return 'fire';
		case Spec.SpecFrostMage: return 'frost';
		// Monk
		case Spec.SpecBrewmasterMonk: return 'brewmaster';
		case Spec.SpecMistweaverMonk: return 'mistweaver';
		case Spec.SpecWindwalkerMonk: return 'windwalker';
		// Paladin
		case Spec.SpecHolyPaladin: return 'holy';
		case Spec.SpecProtectionPaladin: return 'protection';
		case Spec.SpecRetributionPaladin: return 'retribution';
		// Priest
		case Spec.SpecDisciplinePriest: return 'discipline';
		case Spec.SpecHolyPriest: return 'holy';
		case Spec.SpecShadowPriest: return 'shadow';
		// Rogue
		case Spec.SpecAssassinationRogue: return 'assassination';
		case Spec.SpecCombatRogue: return 'combat';
		case Spec.SpecSubtletyRogue: return 'subtlety';
		// Shaman
		case Spec.SpecElementalShaman: return 'elemental';
		case Spec.SpecEnhancementShaman: return 'enhancement';
		case Spec.SpecRestorationShaman: return 'restoration';
		// Warlock
		case Spec.SpecAfflictionWarlock: return 'affliction';
		case Spec.SpecDemonologyWarlock: return 'demonology';
		case Spec.SpecDestructionWarlock: return 'destruction';
		// Warrior
		case Spec.SpecArmsWarrior: return 'arms';
		case Spec.SpecFuryWarrior: return 'fury';
		case Spec.SpecProtectionWarrior: return 'protection';
		default: return 'unknown';
	}
};

export const translateClass = (className: string): string => {
	const normalizedClassName = className.toLowerCase().replace(/_/g, '');
	const i18nKey = normalizedClassName === 'deathknight' ? 'death_knight' : normalizedClassName;
	return i18n.t(`common.classes.${i18nKey}`);
};

export const translateSpec = (className: string, specName: string): string => {
	const normalizedClassName = className.toLowerCase().replace(/_/g, '');
	const classKey = normalizedClassName === 'deathknight' ? 'death_knight' : normalizedClassName;
	const specKey = specName.toLowerCase();
	return i18n.t(`common.specs.${classKey}.${specKey}`);
};

export const translatePlayerClass = (playerClass: PlayerClass<any>): string => {
	const classKey = classEnumToString(playerClass.classID);
	return translateClass(classKey);
};

export const translatePlayerSpec = (playerSpec: PlayerSpec<any>): string => {
	const classKey = classEnumToString(playerSpec.classID);
	const specKey = specEnumToString(playerSpec.specID);
	return translateSpec(classKey, specKey);
};

export const extractClassAndSpecFromLink = (link: HTMLAnchorElement): { className?: string; specName?: string } => {
	const parts = link.pathname.split('/').filter(Boolean);
	if (parts.length >= 2) {
		return {
			className: parts[1],
			specName: parts[2]
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
		const li = document.createElement('li');
		const a = document.createElement('a');
		a.className = `dropdown-item ${code === currentLang ? 'active' : ''}`;
		a.href = '#';
		a.dataset.lang = code;
		a.textContent = name;
		a.onclick = e => {
			e.preventDefault();
			setLang(code);
			window.location.reload();
		};
		li.appendChild(a);
		dropdownMenu.appendChild(li);
	});
};

export const updateDataI18nElements = (): void => {
	document.querySelectorAll('[data-i18n]').forEach(element => {
		const key = element.getAttribute('data-i18n');
		if (key) {
			element.textContent = i18n.t(key);
		}
	});
};

export const updateSimPageMetadata = (): void => {
	const classSpecInfo = extractClassAndSpecFromDataAttributes();
	if (!classSpecInfo) return;

	const { className, specName } = classSpecInfo;

	const translatedClass = translateClass(className);
	const translatedSpec = translateSpec(className, specName);

	const titleElement = document.querySelector('title');
	if (titleElement) {
		const titleTemplate = i18n.t('sim.title');
		titleElement.textContent = titleTemplate
			.replace('{class}', translatedClass)
			.replace('{spec}', translatedSpec);
	}

	const metaDescription = document.querySelector('meta[name="description"]') as HTMLMetaElement;
	if (metaDescription) {
		const descriptionTemplate = i18n.t('sim.description');
		metaDescription.content = descriptionTemplate
			.replace('{class}', translatedClass)
			.replace('{spec}', translatedSpec);
	}
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
	const finalOptions = options || (
		document.querySelector('title[data-class]') || document.querySelector('meta[data-class]')
			? { updateSimMetadata: true }
			: { updateSimLinks: true, updateLanguageDropdown: true }
	);

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
