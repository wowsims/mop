package dbc

import (
	"slices"
	"sort"

	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

type Enchant struct {
	EffectId           int
	Name               string
	SpellId            int
	ItemId             int
	ProfessionId       int
	Effects            []int
	EffectPoints       []int
	EffectArgs         []int
	IsWeaponEnchant    bool
	InventoryType      InventoryTypeFlag
	SubClassMask       int
	ClassMask          int
	FDID               int
	Quality            ItemQuality
	RequiredProfession int
	EffectName         string
}

// Synthesises the on-use effect of an ITEM_ENCHANTMENT_USE_SPELL entry.
// The enchantment itself carries no trigger data, so the cooldown, spell category and
// category cooldown come from the spell it casts. Most of these are engineering tinkers
// whose actual buff is server-scripted and therefore not reachable from SpellEffect, but
// the trigger, cooldown and duration are all present in DBC and worth carrying.
func (enchant *Enchant) OnUseEffect() (ItemEffect, bool) {
	idx := slices.Index(enchant.Effects, ITEM_ENCHANTMENT_USE_SPELL)
	if idx < 0 || idx >= len(enchant.EffectArgs) {
		return ItemEffect{}, false
	}

	spellID := enchant.EffectArgs[idx]
	spell, ok := GetDBC().Spells[spellID]
	if !ok {
		return ItemEffect{}, false
	}

	return ItemEffect{
		TriggerType:          ITEM_SPELLTRIGGER_ON_USE,
		SpellID:              spellID,
		CoolDownMSec:         int(spell.Cooldown),
		SpellCategoryID:      int(spell.Category),
		CategoryCoolDownMSec: int(spell.CategoryRecoveryTime),
	}, true
}

// Assembles a proc effect whose stats come from an explicitly linked buff spell instead of
// from a chain resolved out of SpellEffect. The trigger data - proc
// rate, its modifiers and the internal cooldown - still comes from the enchant's own spell,
// and the buff spell supplies the stats, duration and stack count.
//
// hasStats is false when the buff applies something that is not a stat, such as the damage
// absorb behind Colossus.
func (enchant *Enchant) buildLinkedProcEffect(buffSpellID int) (*proto.ItemEffect, bool) {
	trigger := ItemEffect{TriggerType: ITEM_SPELLTRIGGER_CHANCE_ON_HIT, SpellID: enchant.SpellId}

	parsedEffect := makeBaseProto(&trigger, buffSpellID)
	assignTrigger(&trigger, buffSpellID, parsedEffect)

	props := buildScalingProps(buffSpellID, 0, enchant.SpellId)
	parsedEffect.ScalingOptions[0] = props

	return parsedEffect, len(props.Stats) > 0
}

func (enchant *Enchant) HasEnchantEffect() bool {
	for idx, effect := range enchant.Effects {
		if effect == ITEM_ENCHANTMENT_COMBAT_SPELL {
			return true
		}

		// We apply a buff here, check if it's a trigger
		if effect == ITEM_ENCHANTMENT_EQUIP_SPELL {
			spellId := enchant.EffectArgs[idx]
			for _, spellEffect := range GetDBC().SpellEffectsInOrder(spellId) {
				if spellEffect.EffectAura == A_PROC_TRIGGER_SPELL ||
					spellEffect.EffectAura == A_PROC_TRIGGER_SPELL_WITH_VALUE ||
					// Damage procs such as the shield spikes hang their amount straight
					// off the aura instead of triggering a separate spell.
					spellEffect.EffectAura == A_PROC_TRIGGER_DAMAGE {
					return true
				}
			}
		}
	}

	return false
}

func (enchant *Enchant) ToProto() *proto.UIEnchant {
	uiEnchant := &proto.UIEnchant{
		Name:               enchant.Name,
		ItemId:             int32(enchant.ItemId),
		SpellId:            int32(enchant.SpellId),
		EffectId:           int32(enchant.EffectId),
		ClassAllowlist:     GetClassesFromClassMask(enchant.ClassMask),
		ExtraTypes:         []proto.ItemType{},
		Stats:              stats.Stats{}.ToProtoArray(),
		Quality:            enchant.Quality.ToProto(),
		RequiredProfession: GetProfession(enchant.RequiredProfession),
	}

	if enchant.HasEnchantEffect() {
		eff := ItemEffect{TriggerType: ITEM_SPELLTRIGGER_CHANCE_ON_HIT, SpellID: enchant.SpellId}
		parsedEffect, hasStats := eff.BuildProto(0, 0)
		// Damage procs grant no stats, so requiring stats here dropped them without a trace.
		if hasStats || ResolveDamageEffect(enchant.SpellId) != nil {
			uiEnchant.EnchantEffects = append(uiEnchant.EnchantEffects, parsedEffect)
		}
	}

	// Enchants whose buff spell is only reachable through an explicit link.
	for _, buffSpellID := range EnchantBuffSpellOverrides[enchant.EffectId] {
		if parsedEffect, hasStats := enchant.buildLinkedProcEffect(buffSpellID); hasStats {
			uiEnchant.EnchantEffects = append(uiEnchant.EnchantEffects, parsedEffect)
		}
	}

	// Kept regardless of whether stats resolve: the on-use trigger, its cooldown and the
	// buff duration are real data even when the buff itself is server-scripted.
	if useEffect, ok := enchant.OnUseEffect(); ok {
		parsedEffect, _ := useEffect.BuildProto(0, 0)
		uiEnchant.EnchantEffects = append(uiEnchant.EnchantEffects, parsedEffect)
	}

	if enchant.FDID == 0 {
		uiEnchant.Icon = "trade_engraving"
	}

	if enchant.IsWeaponEnchant {
		// Process weapon enchants.
		uiEnchant.Type = proto.ItemType_ItemTypeWeapon
		if enchant.SubClassMask == ITEM_SUBCLASS_BIT_WEAPON_STAFF {
			// Staff only.
			uiEnchant.EnchantType = proto.EnchantType_EnchantTypeStaff
		}
		if enchant.SubClassMask == rangedMask {
			uiEnchant.Type = proto.ItemType_ItemTypeRanged
		}
		if enchant.SubClassMask == twoHandMask {
			// Two-handed weapon.
			uiEnchant.EnchantType = proto.EnchantType_EnchantTypeTwoHand
		}
	} else {
		// Process non-weapon enchants.
		if enchant.SubClassMask == OffHandValue {
			uiEnchant.EnchantType = proto.EnchantType_EnchantTypeOffHand
			uiEnchant.Type = proto.ItemType_ItemTypeWeapon
		}
		// Matches the "Enchant Shield - ..." scrolls. Not the shield spikes: those carry
		// ShieldValue1 and fall through to no item type at all. Adding ShieldValue1 here also
		// needs the ItemTypeWeapon branch of BuildSpellProcInfo dealt with, which would
		// otherwise give a block-triggered proc an outgoing-hit callback.
		if enchant.SubClassMask == ITEM_SUBCLASS_BIT_ARMOR_SHIELD {
			uiEnchant.EnchantType = proto.EnchantType_EnchantTypeShield
			uiEnchant.Type = proto.ItemType_ItemTypeWeapon
		}
		// Sort flags for consistent generation
		var flags []int
		for flag := range MapInventoryTypeToEnchantMetaType {
			flags = append(flags, int(flag))
		}

		sort.Ints(flags)

		for _, f := range flags {
			flag := InventoryTypeFlag(f)
			m := MapInventoryTypeToEnchantMetaType[flag]
			if enchant.InventoryType.Has(flag) {
				if uiEnchant.Type != proto.ItemType_ItemTypeUnknown {
					uiEnchant.ExtraTypes = append(uiEnchant.ExtraTypes, m.ItemType)
				} else {
					uiEnchant.Type = m.ItemType
				}
			}
		}
		slices.Sort(uiEnchant.ExtraTypes)
	}
	stats := stats.Stats{}
	processEnchantmentEffects(enchant.Effects, enchant.EffectArgs, enchant.EffectPoints, &stats, true)
	uiEnchant.Stats = stats.ToProtoArray()
	return uiEnchant
}
