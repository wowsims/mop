import i18n from './config';
import { getLanguageCode } from './language_service';

// Elements that need translation
const TRANSLATION_KEYS = {
  'title': 'home.title',
  'description': 'home.description',
  'start-simulation': 'home.startSimulation',
  'browse-simulations': 'home.browseSimulations',
  'documentation': 'home.documentation',
  'github': 'home.github'
};

// Function to translate class names
function translateClass(className: string): string {
  return i18n.t(`classes.${className.toLowerCase().replace(/ /g, '_')}`);
}

// Function to translate spec names
function translateSpec(className: string, specName: string): string {
  return i18n.t(`specs.${className.toLowerCase().replace(/ /g, '_')}.${specName.toLowerCase().replace(/ /g, '_')}`);
}

function extractClassAndSpecFromLink(link: HTMLAnchorElement): { className: string, specName?: string } | null {
  // Example: /mop/mage/arcane/
  const match = link.getAttribute('href')?.match(/\/mop\/([^\/]+)(?:\/([^\/]+))?\//);
  if (match) {
    return {
      className: match[1].replace(/_/g, ' '),
      specName: match[2] ? match[2].replace(/_/g, ' ') : undefined
    };
  }
  return null;
}

function localizeHomePage() {
  i18n.on('initialized', () => {
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      if (key) {
        element.textContent = i18n.t(key);
      }
    });

    // For each sim-link-content, translate class and spec names
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
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', localizeHomePage);
} else {
  localizeHomePage();
}
