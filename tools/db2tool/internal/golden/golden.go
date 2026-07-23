// Package golden is the validation harness for tools/db2tool: it compares a
// freshly built wowsims.db against a captured reference database — schema
// DDL, per-table row counts, and canonical row dumps.
package golden

import (
	"database/sql"
	"fmt"
	"math"
	"strings"
)

// CriticalTables is the byte-exact-critical set: row + value parity
// required. Slack tables must merely extract without error.
var CriticalTables = []string{
	"Item", "ItemSparse", "SpellEffect", "SpellItemEnchantment", "ItemRandomSuffix",
	"RandPropPoints", "SpellMisc",
	"ItemDamageAmmo", "ItemDamageOneHand", "ItemDamageOneHandCaster", "ItemDamageRanged",
	"ItemDamageThrown", "ItemDamageTwoHand", "ItemDamageTwoHandCaster", "ItemDamageWand",
	"ItemArmorQuality", "ItemArmorShield", "ItemArmorTotal", "ArmorLocation",
	"GemProperties", "ItemEffect", "ItemClass", "ItemSubClass", "ItemSet",
	"ItemNameDescription", "RulesetItemUpgrade", "ItemUpgrade",
	"Spell", "SpellName", "SpellLevels", "SpellCooldowns", "SpellScaling", "SpellLabel",
	"SpellCategories", "SpellCategory", "SpellDuration", "SpellPower", "SpellInterrupts",
	"SpellEquippedItems", "SpellAuraOptions", "SpellClassOptions", "SpellShapeshift",
	"SpellXDescriptionVariables", "SpellDescriptionVariables", "SpellTargetRestrictions",
	"SpellRange", "SpellRadius", "SpellProcsPerMinute", "SpellProcsPerMinuteMod",
	"GlyphProperties", "SkillLineAbility", "Talent", "Faction", "Map",
	"JournalEncounter", "JournalEncounterItem", "JournalInstance", "AreaTable",
}

// SchemaDDL returns the whitespace-normalized sqlite_master entries, sorted,
// excluding objects related to item_enchantment_template (created later by
// gen_db's overrides, not by the extractor).
func SchemaDDL(db *sql.DB) ([]string, error) {
	rows, err := db.Query(`SELECT type, name, tbl_name, COALESCE(sql,'') FROM sqlite_master
		WHERE name != 'item_enchantment_template' AND tbl_name != 'item_enchantment_template'
		ORDER BY type, name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var typ, name, tbl, ddl string
		if err := rows.Scan(&typ, &name, &tbl, &ddl); err != nil {
			return nil, err
		}
		out = append(out, fmt.Sprintf("%s|%s|%s|%s", typ, name, tbl, strings.Join(strings.Fields(ddl), " ")))
	}
	return out, rows.Err()
}

// TableNames lists extractor-created tables in sqlite_master order.
func TableNames(db *sql.DB) ([]string, error) {
	rows, err := db.Query(`SELECT name FROM sqlite_master WHERE type='table'
		AND name != 'item_enchantment_template' ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		out = append(out, name)
	}
	return out, rows.Err()
}

func pkColumn(db *sql.DB, table string) (string, error) {
	var pk string
	err := db.QueryRow(fmt.Sprintf("SELECT name FROM pragma_table_info('%s') WHERE pk=1", table)).Scan(&pk)
	return pk, err
}

// DumpRows returns one canonical line per row (SELECT * ORDER BY pk), using
// the driver's text rendering so both databases go through identical
// formatting.
func DumpRows(db *sql.DB, table string) ([]string, error) {
	pk, err := pkColumn(db, table)
	if err != nil {
		return nil, fmt.Errorf("%s: no pk: %w", table, err)
	}
	rows, err := db.Query(fmt.Sprintf("SELECT * FROM [%s] ORDER BY [%s]", table, pk))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	var out []string
	vals := make([]any, len(cols))
	ptrs := make([]any, len(cols))
	for i := range vals {
		ptrs[i] = &vals[i]
	}
	var sb strings.Builder
	for rows.Next() {
		if err := rows.Scan(ptrs...); err != nil {
			return nil, err
		}
		sb.Reset()
		for i, v := range vals {
			if i > 0 {
				sb.WriteByte('|')
			}
			switch t := v.(type) {
			case nil:
				sb.WriteString("<NULL>")
			case []byte:
				sb.Write(t)
			case string:
				sb.WriteString(t)
			case int64:
				fmt.Fprintf(&sb, "%d", t)
			case float64:
				// %v matches across both DBs; exactness comes from comparing
				// the same driver rendering on both sides.
				fmt.Fprintf(&sb, "%v", t)
			default:
				fmt.Fprintf(&sb, "%v", t)
			}
		}
		out = append(out, sb.String())
	}
	return out, rows.Err()
}

// DiffLines reports lines present on only one side (unified count, not
// positions) — enough to gate parity and cheap on 100k-row tables.
func DiffLines(ref, got []string) (refOnly, gotOnly []string) {
	counts := make(map[string]int, len(ref))
	for _, l := range ref {
		counts[l]++
	}
	for _, l := range got {
		if counts[l] > 0 {
			counts[l]--
		} else {
			gotOnly = append(gotOnly, l)
		}
	}
	for l, n := range counts {
		for i := 0; i < n; i++ {
			refOnly = append(refOnly, l)
		}
	}
	return refOnly, gotOnly
}

// FloatDiverges reports whether a float32 value falls where the reference
// database's shortest-round-trip text rendering and Go's diverge: the
// reference switches to scientific notation for |v| < 1e-4 or >= 1e15, Go
// only below 1e-6 or at >= 1e21. Zero is fine.
func FloatDiverges(v float32) bool {
	a := math.Abs(float64(v))
	if a == 0 {
		return false
	}
	return (a >= 1e-6 && a < 1e-4) || (a >= 1e15 && a < 1e21)
}
