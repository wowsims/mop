// ui-kit components that nothing imports.
//
// Phase 2's rule is that a React primitive lands when its first consumer ports, not before — a
// component with no caller is unreviewed against a real config, and the migration has already
// produced four of them by building ahead of the rule being written down. This is that rule with
// teeth, and it is static: no browser, no build, no servers.
//
// It is not an allowlist. An entry in `ALLOWED` that has since gained an importer fails too, so a
// component stops being excused the moment it stops needing to be — the same discipline `INTENDED`
// follows in `parity.mjs`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const UI_KIT = 'ui/ui-kit';

// Kept deliberately, with the reason. Delete an entry when its consumer lands.
const ALLOWED = {
	NumberListPicker: 'ported and parity-tested against a vanilla twin with 4 live callers; those callers are apl and gear',
	AdaptiveStringPicker: 'ported and parity-tested against a vanilla twin with 4 live callers; those callers are apl and gear',
};

// A component directory: PascalCase, with an index.ts. `hooks/`, `pickers/` and `testing/` are not.
const components = readdirSync(UI_KIT).filter(name => /^[A-Z]/.test(name) && statSync(join(UI_KIT, name)).isDirectory());

const sources = [];
const walk = dir => {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) walk(path);
		else if (/\.tsx?$/.test(entry.name)) sources.push(path);
	}
};
walk('ui');

const importersOf = name => {
	// Its own directory does not count, and neither does a test — a component whose only importer is
	// its own test is exactly the case this looks for.
	const inside = `${UI_KIT}/${name}/`;
	const pattern = new RegExp(`from '(@ui-kit/${name}|[./]+${name})'`);
	return sources.filter(path => !path.startsWith(inside) && !/\.test\.tsx?$/.test(path) && pattern.test(readFileSync(path, 'utf8')));
};

const problems = [];
console.log('ui-kit components with no importer\n');
for (const name of components) {
	const importers = importersOf(name);
	const excuse = ALLOWED[name];
	if (importers.length === 0) {
		console.log(`  ${excuse ? 'allowed' : 'UNUSED '}  ${name}${excuse ? ` — ${excuse}` : ''}`);
		if (!excuse)
			problems.push(
				`${name} has no importer. Phase 2 builds a primitive when its first consumer ports; either wire it up, delete it, or record why it waits in ALLOWED.`,
			);
	} else if (excuse) {
		problems.push(`${name} is excused in ALLOWED but ${importers.length} file(s) import it now — drop the entry.`);
	}
}

if (!problems.length) console.log(`\n${Object.keys(ALLOWED).length} allowed, 0 unexpected`);
else problems.forEach(problem => console.log(`\nFAIL  ${problem}`));
process.exit(problems.length ? 1 : 0);
