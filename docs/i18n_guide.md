# i18n Guide

Hey there! 👋 This guide will help you work with translations in our WoW sim project.

## Adding New Locale

1. Create `{lang}/translation.json` in `assets/locales`. For example, `de/translation.json`.
2. Vite will now automatically pickup the new translation and add it to the resources

## Adding New Text

When you've added a new key you can update the translation schema using this URL: https://jsontoolhub.com/json-schema-generator by pasting in the `en.json`.
The result you can paste in `schemsa/translation.schema.json`.

This is done so you can see warnings in the translation files incase you've missed a new entry.

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
			"chooseSpec": "Choose Spec", // Reusable!
			"currentSpec": "Current Spec"
		}
	}
}
```

❌ Don't do this:

```json
{
	"btn1": "Save", // Too vague
	"CANCEL_BUTTON": "Cancel", // Weird casing
	"spec-name": "Fire", // No hyphens please
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
