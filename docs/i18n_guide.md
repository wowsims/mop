# i18n Guide

Hey there! 👋 This guide will help you work with translations in our WoW sim project.

## Adding New LocaleAdd commentMore actions

1. Create `{lang}.json` in `assets/locales`. For example, `de.json`.

2. In `vite.config.mts`, add the file to the list of locales

```
function copyLocales() {
	return {
		...
		buildStart() {
			const locales = [
				'en.json',
				'de.json', <---- add your new locale file
			];
			...
		},
	} satisfies PluginOption;
}
```

3. In `\ui\i18n\config.ts`, import the locale file and add it to the resource list

```
import de from '../../assets/locales/de.json';

resources: {
    en: {
      	translation: en
    },
	de: {
		translation: de
	}
  }
```

## Adding New Text

All translations start in `en.json`. Here's how to structure it:

```json
{
  "common": {
    "buttons": {
      "save": "Save",
      "cancel": "Cancel"
    }
  },
  "gear": {
    "equipment": {
      "head": "Head",
      "chest": "Chest"
    }
  }
}
```

### Quick Tips for Keys

✅ Do this:
```json
{
  "talents": {
    "specSelection": {
      "chooseSpec": "Choose Spec",  // Reusable!
      "currentSpec": "Current Spec"
    }
  }
}
```

❌ Don't do this:
```json
{
  "btn1": "Save",           // Too vague
  "CANCEL_BUTTON": "Cancel", // Weird casing
  "spec-name": "Fire",      // No hyphens please
  "talentPageTitle": "Talents Page" // Too specific
}
```

## Using Translations in Code

### In TypeScript/TSX

```typescript
import { i18n } from '../i18n/config';

// Simple usage
const saveText = i18n.t('common.buttons.save');

// With variables
const welcome = i18n.t('common.welcome', { name: playerName });
```

### In Components

```tsx
function SettingsMenu() {
  return (
    <div>
      <h1>{i18n.t('settings.title')}</h1>
      <button>{i18n.t('common.buttons.save')}</button>
    </div>
  );
}
```

## Pro Tips 🎮

1. **Keep it Reusable**
   ```json
   // ✅ Good - can use everywhere
   "common.buttons.save": "Save"

   // ❌ Bad - too specific
   "talentPageSaveButton": "Save"
   ```

2. **Use Variables for Dynamic Stuff**
   ```json
   {
     "character": {
       "levelUp": "{{name}} hit level {{level}}!" // Nice!
     }
   }
   ```

3. **Group Related Things**
   ```json
   {
     "gear": {
       "equipment": {
         "head": "Head",
         "chest": "Chest"
       }
     }
   }
   ```

That's it! Keep it simple and reusable. If you need to add new languages, just copy `en.json` and translate away! 🚀