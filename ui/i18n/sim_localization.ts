import i18n from './config';
import { getLang } from './locale_service';

// Function to translate class names
function translateClass(className: string): string {
	// Handle special case where URL has underscores but i18n keys don't
	const normalizedClassName = className.toLowerCase().replace(/_/g, '');
	const i18nKey = normalizedClassName === 'deathknight' ? 'death_knight' : normalizedClassName;
	return i18n.t(`common.classes.${i18nKey}`);
}

// Function to translate spec names
function translateSpec(className: string, specName: string): string {
	// Handle special case where URL has underscores but i18n keys don't
	const normalizedClassName = className.toLowerCase().replace(/_/g, '');
	const classKey = normalizedClassName === 'deathknight' ? 'death_knight' : normalizedClassName;
	const specKey = specName.toLowerCase().replace(/_/g, '');
	return i18n.t(`common.specs.${classKey}.${specKey}`);
}

// Extract class and spec from title or meta description data attributes
function extractClassAndSpecFromDataAttributes(): { className: string; specName: string } | null {
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

function updateSimPageTranslations() {
	// Set HTML lang attribute
	document.documentElement.lang = getLang();

	const urlInfo = extractClassAndSpecFromDataAttributes();
	if (!urlInfo) return;

	const { className, specName } = urlInfo;

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

	// Update any other elements with data-i18n attributes
	document.querySelectorAll('[data-i18n]').forEach(element => {
		const key = element.getAttribute('data-i18n');
		if (key) {
			element.textContent = i18n.t(key);
		}
	});
}

function localizeSimPage() {
	// Initialize i18n if not already initialized
	if (!i18n.isInitialized) {
		i18n.init();
	}

	// Update translations when language changes
	i18n.on('languageChanged', () => {
		updateSimPageTranslations();
	});

	// Initial translation
	updateSimPageTranslations();
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', localizeSimPage);
} else {
	localizeSimPage();
}

export default localizeSimPage;
