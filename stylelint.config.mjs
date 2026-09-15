const kebabCasePattern = /^([a-z][a-z0-9]*)(-[a-z0-9]+)*$/;

export default {
	customSyntax: 'postcss',
	ignoreFiles: ['node_modules'],
	rules: {
		'max-nesting-depth': [6, { ignore: ['pseudo-classes'] }],
		'no-empty-source': null,
		'no-descending-specificity': null,
		'keyframes-name-pattern': kebabCasePattern,
		'at-rule-empty-line-before': [
			'always',
			{
				except: ['first-nested'],
				ignore: ['after-comment', 'blockless-after-blockless', 'blockless-after-same-name-blockless'],
				ignoreAtRules: ['else'],
			},
		],
		'at-rule-no-unknown': [
			true,
			{
				ignoreAtRules: ['theme', 'utility', 'apply', 'custom-variant', 'variant', 'source', 'reference'],
			},
		],
		'at-rule-no-vendor-prefix': true,
		'rule-empty-line-before': [
			'always',
			{
				except: ['first-nested'],
				ignore: ['after-comment'],
			},
		],
		'property-no-vendor-prefix': true,
		'function-no-unknown': [
			true,
			{
				ignoreFunctions: ['--spacing', '--alpha', '--theme', 'theme'],
			},
		],
	},
};
