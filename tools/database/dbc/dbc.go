package dbc

import (
	"encoding/json"
	"fmt"
	"log"
	"slices"
	"sync"
)

type DBC struct {
	Items                  map[int]Item                       // Item ID
	Gems                   map[int]Gem                        // Item ID
	Enchants               map[int]Enchant                    // ItemEchantment ID
	SocketBonuses          map[int]SocketBonus                // Keyed on SpellItemEnchantment.ID
	SpellEffects           map[int]map[int]SpellEffect        // Search by spellID and effect index
	SpellEffectsById       map[int]SpellEffect                // Search by effectid
	Spells                 map[int]Spell                      // Search by spellId
	RandomSuffix           map[int]RandomSuffix               // Item level
	ItemDamageTable        map[string]map[int]ItemDamageTable // By Table name and item level
	RandomPropertiesByIlvl map[int]RandomPropAllocationMap
	ItemArmorQuality       map[int]ItemArmorQuality
	ItemArmorShield        map[int]ItemArmorShield
	ItemArmorTotal         map[int]ItemArmorTotal
	ArmorLocation          map[int]ArmorLocation
	SpellScalings          map[int]SpellScaling
	Consumables            map[int]Consumable   // Item ID
	ItemEffects            map[int]ItemEffect   // Effect ID
	ItemEffectsByParentID  map[int][]ItemEffect // ParentItemID
}

func NewDBC() *DBC {
	return &DBC{
		Items:                  make(map[int]Item),
		Gems:                   make(map[int]Gem),
		Enchants:               make(map[int]Enchant),
		SocketBonuses:          make(map[int]SocketBonus),
		SpellEffects:           make(map[int]map[int]SpellEffect),
		SpellEffectsById:       make(map[int]SpellEffect),
		Spells:                 make(map[int]Spell),
		RandomSuffix:           make(map[int]RandomSuffix),
		ItemDamageTable:        make(map[string]map[int]ItemDamageTable),
		RandomPropertiesByIlvl: make(map[int]RandomPropAllocationMap),
		ItemArmorQuality:       make(map[int]ItemArmorQuality),
		ItemArmorShield:        make(map[int]ItemArmorShield),
		ItemArmorTotal:         make(map[int]ItemArmorTotal),
		ArmorLocation:          make(map[int]ArmorLocation),
		Consumables:            make(map[int]Consumable),
		ItemEffects:            make(map[int]ItemEffect),
		SpellScalings:          make(map[int]SpellScaling),
		ItemEffectsByParentID:  make(map[int][]ItemEffect),
	}
}

// The directory gen_db writes its extractions to, relative to the repo root.
const DefaultInputsDir = "./assets/db_inputs/dbc"

// One gzipped input file and how its contents fold into a DBC.
type inputLoader struct {
	name string
	load func(d *DBC, path string) error
}

// Describes an input file holding a flat list of rows, and how each row is keyed.
func indexedInput[T any](name string, typeName string, index func(*DBC, T)) inputLoader {
	return inputLoader{name: name, load: func(d *DBC, path string) error {
		rows, err := decodeInput[[]T](path, typeName)
		if err != nil {
			return err
		}
		for _, row := range rows {
			index(d, row)
		}
		return nil
	}}
}

// Describes an input file that is already shaped like the table it lands in.
func wholeInput[T any](name string, typeName string, assign func(*DBC, T)) inputLoader {
	return inputLoader{name: name, load: func(d *DBC, path string) error {
		decoded, err := decodeInput[T](path, typeName)
		if err != nil {
			return err
		}
		assign(d, decoded)
		return nil
	}}
}

func decodeInput[T any](path string, typeName string) (T, error) {
	var decoded T

	data, err := ReadGzipFile(path)
	if err != nil {
		return decoded, err
	}
	if err := json.Unmarshal(data, &decoded); err != nil {
		return decoded, ParseError{
			Source: path,
			Field:  typeName,
			Reason: err.Error(),
		}
	}
	return decoded, nil
}

// Every input file, in load order. The files are independent of one another, so the order is
// kept only because it is the order the extraction writes them in.
var dbcInputs = []inputLoader{
	indexedInput("items", "Item", func(d *DBC, row Item) { d.Items[row.Id] = row }),
	indexedInput("gems", "Gem", func(d *DBC, row Gem) { d.Gems[row.ItemId] = row }),
	indexedInput("enchants", "Enchant", func(d *DBC, row Enchant) { d.Enchants[row.EffectId] = row }),
	indexedInput("socket_bonuses", "SocketBonus", func(d *DBC, row SocketBonus) { d.SocketBonuses[row.ID] = row }),
	wholeInput("spell_effects", "SpellEffect", func(d *DBC, decoded map[int]map[int]SpellEffect) {
		d.SpellEffects = decoded
		for _, spell := range decoded {
			for _, effect := range spell {
				d.SpellEffectsById[effect.ID] = effect
			}
		}
	}),
	indexedInput("random_suffix", "RandomSuffix", func(d *DBC, row RandomSuffix) { d.RandomSuffix[row.ID] = row }),
	wholeInput("rand_prop_points", "RandomProps", func(d *DBC, decoded RandomPropAllocationsByIlvl) {
		d.RandomPropertiesByIlvl = decoded
	}),
	wholeInput("item_damage_tables", "ItemDamage", func(d *DBC, decoded map[string]map[int]ItemDamageTable) {
		d.ItemDamageTable = decoded
	}),
	wholeInput("item_armor_quality", "ItemArmorQuality", func(d *DBC, decoded map[int]ItemArmorQuality) {
		d.ItemArmorQuality = decoded
	}),
	wholeInput("item_armor_total", "ItemArmorTotal", func(d *DBC, decoded map[int]ItemArmorTotal) {
		d.ItemArmorTotal = decoded
	}),
	wholeInput("item_armor_shield", "ItemArmorShield", func(d *DBC, decoded map[int]ItemArmorShield) {
		d.ItemArmorShield = decoded
	}),
	wholeInput("armor_location", "ArmorLocation", func(d *DBC, decoded map[int]ArmorLocation) {
		d.ArmorLocation = decoded
	}),
	indexedInput("consumables", "Consumable", func(d *DBC, row Consumable) { d.Consumables[row.Id] = row }),
	indexedInput("item_effects", "ItemEffect", func(d *DBC, row ItemEffect) {
		// Single lookup by effect ID, plus a grouping by parent item ID.
		d.ItemEffects[row.ID] = row
		d.ItemEffectsByParentID[row.ParentItemID] = append(d.ItemEffectsByParentID[row.ParentItemID], row)
	}),
	indexedInput("spells", "Spell", func(d *DBC, row Spell) { d.Spells[int(row.ID)] = row }),
}

var (
	dbcInstance *DBC
	initOnce    sync.Once
)

// InitDBC loads the singleton from the default input directory.
func InitDBC() error {
	return InitDBCFrom(DefaultInputsDir)
}

// InitDBCFrom loads the singleton from inputsDir, replacing whatever was loaded before. The
// instance is only published once every file has been read, so a failed load leaves the previous
// one in place rather than a half-populated replacement.
func InitDBCFrom(inputsDir string) error {
	instance := NewDBC()

	for _, input := range dbcInputs {
		path := fmt.Sprintf("%s/%s.json", inputsDir, input.name)
		if err := input.load(instance, path); err != nil {
			return fmt.Errorf("loading %s: %w", input.name, err)
		}
	}
	instance.LoadSpellScaling()

	dbcInstance = instance
	return nil
}

// GetDBC returns the DBC singleton instance, loading it from the default input directory on
// first use. Every read of the singleton, inside this package and out, goes through here, so
// code that never called InitDBC gets a populated instance rather than a nil dereference.
func GetDBC() *DBC {
	initOnce.Do(func() {
		// An explicit InitDBC or InitDBCFrom may already have supplied the instance.
		if dbcInstance != nil {
			return
		}
		if err := InitDBC(); err != nil {
			log.Fatalf("Failed to initialize DBC: %v", err)
		}
	})
	return dbcInstance
}

// Returns the effects of a spell ordered by effect index. SpellEffects is keyed by index, so
// ranging over it directly yields a random order and makes any traversal that stops at the
// first match non-deterministic.
func (d *DBC) SpellEffectsInOrder(spellID int) []SpellEffect {
	effects := d.SpellEffects[spellID]
	if len(effects) == 0 {
		return nil
	}

	indices := make([]int, 0, len(effects))
	for idx := range effects {
		indices = append(indices, idx)
	}
	slices.Sort(indices)

	ordered := make([]SpellEffect, 0, len(effects))
	for _, idx := range indices {
		ordered = append(ordered, effects[idx])
	}
	return ordered
}
