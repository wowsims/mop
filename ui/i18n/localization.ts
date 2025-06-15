import i18n from './config';
import { getLang, setLang, supportedLanguages } from './locale_service';

// Function to translate class names
export function translateClass(className: string): string {
	// Handle special case where URL has underscores but i18n keys don't
	const normalizedClassName = className.toLowerCase().replace(/_/g, '');
	const i18nKey = normalizedClassName === 'deathknight' ? 'death_knight' : normalizedClassName;
	return i18n.t(`common.classes.${i18nKey}`);
}

// Function to translate spec names
export function translateSpec(className: string, specName: string): string {
	// Handle special case where URL has underscores but i18n keys don't for class names
	const normalizedClassName = className.toLowerCase().replace(/_/g, '');
	const classKey = normalizedClassName === 'deathknight' ? 'death_knight' : normalizedClassName;
	// Spec names should keep underscores as they match the i18n key structure
	const specKey = specName.toLowerCase();
	return i18n.t(`common.specs.${classKey}.${specKey}`);
}

// Function to extract class and spec names from a link
export function extractClassAndSpecFromLink(link: HTMLAnchorElement): { className?: string; specName?: string } {
	const parts = link.pathname.split('/').filter(Boolean);
	if (parts.length >= 2) {
		return {
			className: parts[1],
			specName: parts[2]
		};
	}
	return {};
}

// Extract class and spec from title or meta description data attributes
export function extractClassAndSpecFromDataAttributes(): { className: string; specName: string } | null {
	const titleElement = document.querySelector('title');
	if (titleElement) {
		const className = titleElement.getAttribute('data-class');
		const specName = titleElement.getAttribute('data-spec');
		if (className && specName) {
			return { className, specName };
		}
	}

	// Fallback to meta description if title doesn't have the data
	const metaDescription = document.querySelector('meta[name="description"]') as HTMLMetaElement;
	if (metaDescription) {
		const className = metaDescription.getAttribute('data-class');
		const specName = metaDescription.getAttribute('data-spec');
		if (className && specName) {
			return { className, specName };
		}
	}
	return null;
}

// Update language dropdown
export function updateLanguageDropdown(): void {
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
}

// Update all elements with data-i18n attributes
export function updateDataI18nElements(): void {
	document.querySelectorAll('[data-i18n]').forEach(element => {
		const key = element.getAttribute('data-i18n');
		if (key) {
			element.textContent = i18n.t(key);
		}
	});
}

// Update sim page title and meta description
export function updateSimPageMetadata(): void {
	const classSpecInfo = extractClassAndSpecFromDataAttributes();
	if (!classSpecInfo) return;

	const { className, specName } = classSpecInfo;

	// Translate class and spec names
	const translatedClass = translateClass(className);
	const translatedSpec = translateSpec(className, specName);

	// Update page title
	const titleElement = document.querySelector('title');
	if (titleElement) {
		const titleTemplate = i18n.t('sim.title');
		titleElement.textContent = titleTemplate
			.replace('{class}', translatedClass)
			.replace('{spec}', translatedSpec);
	}

	// Update meta description
	const metaDescription = document.querySelector('meta[name="description"]') as HTMLMetaElement;
	if (metaDescription) {
		const descriptionTemplate = i18n.t('sim.description');
		metaDescription.content = descriptionTemplate
			.replace('{class}', translatedClass)
			.replace('{spec}', translatedSpec);
	}
}

// Update sim links on home page
export function updateSimLinks(): void {
	document.querySelectorAll('.sim-link-content').forEach(content => {
		const classLabel = content.querySelector('.sim-link-label');
		const specTitle = content.querySelector('.sim-link-title');
		const link = content.closest('a');

		if (classLabel && specTitle && link instanceof HTMLAnchorElement) {
			// Submenu: both class and spec present
			const info = extractClassAndSpecFromLink(link);
			if (info && info.className && info.specName) {
				classLabel.textContent = translateClass(info.className);
				specTitle.textContent = translateSpec(info.className, info.specName);
			}
		} else if (specTitle && link instanceof HTMLAnchorElement) {
			// Main menu: only a title, treat as class
			const info = extractClassAndSpecFromLink(link);
			if (info && info.className) {
				specTitle.textContent = translateClass(info.className);
			}
		}
	});
}

// Configuration options for localization
export interface LocalizationOptions {
	updateSimMetadata?: boolean;
	updateSimLinks?: boolean;
	updateLanguageDropdown?: boolean;
}

// Universal update function
export function updateTranslations(options: LocalizationOptions = {}): void {
	// Set HTML lang attribute
	document.documentElement.lang = getLang();

	// Always update data-i18n elements
	updateDataI18nElements();

	// Conditionally update different parts based on options
	if (options.updateSimMetadata) {
		updateSimPageMetadata();
	}

	if (options.updateSimLinks) {
		updateSimLinks();
	}

	if (options.updateLanguageDropdown) {
		updateLanguageDropdown();
	}
}

// Initialize localization system
export function initializeLocalization(options: LocalizationOptions = {}): void {
	// Initialize i18n if not already initialized
	if (!i18n.isInitialized) {
		i18n.init();
	}

	// Update translations when language changes
	i18n.on('languageChanged', () => {
		updateTranslations(options);
	});

	// Initial translation
	updateTranslations(options);
}

// Convenience function for home page
export function localizeHomePage(): void {
	const homeOptions: LocalizationOptions = {
		updateSimLinks: true,
		updateLanguageDropdown: true
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => initializeLocalization(homeOptions));
	} else {
		initializeLocalization(homeOptions);
	}
}

// Convenience function for sim pages
export function localizeSimPage(): void {
	const simOptions: LocalizationOptions = {
		updateSimMetadata: true
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => initializeLocalization(simOptions));
	} else {
		initializeLocalization(simOptions);
	}
}
