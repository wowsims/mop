package database

const TmplStrOnUse = `package mop

import (
	"github.com/wowsims/mop/sim/common/shared"
)

func RegisterAllOnUseCds() {
{{- range .Groups }}

	// {{ .Name }}
{{- range .Entries }}
	{{if not .Supported}}
	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	{{- end}}
	{{- range (.Tooltip | formatStrings 100) }}
	// {{.}}
	{{- end}}
  	{{with index .Variants 0 -}}
	// https://www.wowhead.com/mop/spell={{.SpellID}}
	{{- end}}
	{{- if not .Supported}}
	{{- if len .Variants | eq 1}}
	{{with index .Variants 0 -}}
	// shared.NewSimpleStatActive({{ .ID }})
	{{- end}}
	{{- else }}
	// shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
	 	{{- range .Variants }}
	// 	{ItemID: {{.ID}}, ItemName: "{{.Name}}"},
	 	{{- end}}
	// })
	{{- end}}
	{{- else}}
	{{- if len .Variants | eq 1}}
	{{with index .Variants 0 -}}
	shared.NewSimpleStatActive({{ .ID }})
	{{- end}}
	{{- else }}
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{{- range .Variants }}
		{ItemID: {{.ID}}, ItemName: "{{.Name}}"},
		{{- end}}
	})
	{{- end}}
	{{- end}}
{{- end }}

{{- end }}
}`
const TmplStrProc = `package mop

import (
	"github.com/wowsims/mop/sim/core"
 	"github.com/wowsims/mop/sim/common/shared"
)

func RegisterAllProcs() {
{{- range .Groups }}

	// {{ .Name }}
{{- range .Entries }}
	{{if not .Supported}}
	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	{{- end}}
	{{- range (.Tooltip | formatStrings 100) }}
	// {{.}}
	{{- end}}
	{{with index .Variants 0 -}}
	// https://www.wowhead.com/mop/spell={{.SpellID}}
	{{- end}}
	{{- if .Supported}}
	{{- if len .Variants | eq 1}}
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		{{with index .Variants 0 -}}
		Name:               "{{ .Name }}",
		ItemID:             {{ .ID }},
		{{- end}}
		Callback:           {{ .ProcInfo.Callback | asCoreCallback }},
		ProcMask:           {{ .ProcInfo.ProcMask | asCoreProcMask }},
		Outcome:            {{ .ProcInfo.Outcome | asCoreOutcome }},
		RequireDamageDealt: {{ .ProcInfo.RequireDamageDealt }},
	})
	{{- else }}
	shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
		Callback:           {{ .ProcInfo.Callback | asCoreCallback }},
		ProcMask:           {{ .ProcInfo.ProcMask | asCoreProcMask }},
		Outcome:            {{ .ProcInfo.Outcome | asCoreOutcome }},
		RequireDamageDealt: {{ .ProcInfo.RequireDamageDealt }},
	}, []shared.ItemVariant{
		{{- range .Variants }}
		{ItemID: {{.ID}}, ItemName: "{{.Name}}"},
		{{- end}}
	})
	{{- end}}
	{{- else}}
	{{- if len .Variants | eq 1}}
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
	 	{{with index .Variants 0 -}}
	// 	Name:               "{{ .Name }}",
	// 	ItemID:             {{ .ID }},
	 	{{- end}}
	// 	Callback:           {{ .ProcInfo.Callback | asCoreCallback }},
	// 	ProcMask:           {{ .ProcInfo.ProcMask | asCoreProcMask }},
	// 	Outcome:            {{ .ProcInfo.Outcome | asCoreOutcome }},
	// 	RequireDamageDealt: {{ .ProcInfo.RequireDamageDealt }},
	// })
	{{- else }}
	// shared.NewProcStatBonusEffectWithVariants(shared.ProcStatBonusEffect{
	//	Callback:           {{ .ProcInfo.Callback | asCoreCallback }},
	//	ProcMask:           {{ .ProcInfo.ProcMask | asCoreProcMask }},
	//	Outcome:            {{ .ProcInfo.Outcome | asCoreOutcome }},
	//	RequireDamageDealt: {{ .ProcInfo.RequireDamageDealt }}
	// }, []shared.ItemVariant{
		{{- range .Variants }}
	//	{ItemID: {{.ID}}, ItemName: "{{.Name}}"},
		{{- end}}
	// })
	{{- end}}
	{{- end}}
{{- end }}

{{- end }}
}`

const TmplStrEnchant = `package mop

import (
	"github.com/wowsims/mop/sim/core"
 	"github.com/wowsims/mop/sim/common/shared"
)

func RegisterAllEnchants() {
{{- range .Groups }}

	// {{ .Name }}
{{- range .Entries }}
	{{if not .Supported}}
	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	{{- end}}
	{{- range (.Tooltip | formatStrings 100) }}
	// {{.}}
	{{- end}}
	{{- if .Supported}}
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		{{with index .Variants 0 -}}
		Name:               "{{ .Name }}",
		EnchantID:          {{ .ID }},
		{{- end}}
		Callback:           {{ .ProcInfo.Callback | asCoreCallback }},
		ProcMask:           {{ .ProcInfo.ProcMask | asCoreProcMask }},
		Outcome:            {{ .ProcInfo.Outcome | asCoreOutcome }},
		RequireDamageDealt: {{ .ProcInfo.RequireDamageDealt }},
	})
	{{- else}}
	// shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		{{- with index .Variants 0 }}
	//	Name:               "{{ .Name }}",
	//	EnchantID:          {{ .ID }},
		{{- end}}
	//	Callback:           {{ .ProcInfo.Callback | asCoreCallback }},
	//	ProcMask:           {{ .ProcInfo.ProcMask | asCoreProcMask }},
	//	Outcome:            {{ .ProcInfo.Outcome | asCoreOutcome }},
	//	RequireDamageDealt: {{ .ProcInfo.RequireDamageDealt }},
	// })
	{{- end}}
{{- end }}

{{- end }}
}`

const TmplStrMissingEffects = `
// This file is auto generated
// Changes will be overwritten on next database generation

export const MISSING_ITEM_EFFECTS = new Map<number, string[]>([
{{- range .ItemEffects }}
	[
		{{.ItemID}}, // {{ .Name }}
		[
			{{- range .Effects }}
			"{{ .Name }}", // {{.SpellID}} - https://www.wowhead.com/tbc/spell={{.SpellID}}
			{{- end}}
		]
	],
{{- end }}
])

export const MISSING_ENCHANT_EFFECTS = new Map<number, string[]>([
{{- range .EnchantEffects }}
{{- $name := .Name }}
{{- range .Entries }}
{{- $tooltip := .Tooltip }}
{{- if not .Supported}}
{{- range .Variants }}
	[{{.ID}}, "{{- range $tooltip }}{{.}}{{- end}}"], // {{ $name }} - {{.SpellID}} - https://www.wowhead.com/tbc/spell={{.SpellID}}
{{- end}}
{{- end }}
{{- end }}
{{- end }}
])
`
