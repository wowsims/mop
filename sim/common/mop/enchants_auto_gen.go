package mop

import (
	"github.com/wowsims/mop/sim/common/shared"
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func RegisterAllEnchants() {

	// Enchants

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Attaches a ghost iron spike to your shield that sometimes deals 209 damage when you block with it.
	//
	// Attaching a ghost iron spike to your shield causes it to become soulbound.
	// shared.NewProcDamageEffect(shared.ProcDamageEffect{
	// 	EnchantID: 5001,
	// 	SpellID:   131465,
	// 	School:    core.SpellSchoolPhysical,
	// 	MinDmg:    600,
	// 	MaxDmg:    1000,
	// 	Flags:     core.SpellFlagNoOnCastComplete | core.SpellFlagPassiveSpell | core.SpellFlagNoOnDamageDealt,
	// 	Trigger: core.ProcTrigger{
	// 		Name:               "Ghost Iron Shield Spike",
	// 		Callback:           core.CallbackOnSpellHitTaken,
	// 		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial,
	// 		Outcome:            core.OutcomeLanded,
	// 		RequireDamageDealt: true,
	// 	},
	// })

	// Permanently enchants a melee weapon to sometimes inflict 2774 additional Elemental damage when dealing
	// damage with spells and melee attacks.
	shared.NewProcDamageEffect(shared.ProcDamageEffect{
		EnchantID: 4443,
		SpellID:   116616,
		School:    core.SpellSchoolFire | core.SpellSchoolNature | core.SpellSchoolFrost,
		MinDmg:    2775,
		MaxDmg:    3225,
		Flags:     core.SpellFlagNoOnCastComplete | core.SpellFlagPassiveSpell | core.SpellFlagNoOnDamageDealt,
		Trigger: core.ProcTrigger{
			Name:               "Enchant Weapon - Elemental Force",
			Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
			ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskSpellProc | core.ProcMaskMeleeProc | core.ProcMaskRangedProc,
			Outcome:            core.OutcomeLanded,
			RequireDamageDealt: false,
		},
	})

	// Permanently enchants a melee weapon to sometimes increase your dodge by 1650 for 7s when dealing melee
	// damage.
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Enchant Weapon - River's Song",
		EnchantID:          4446,
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial | core.ProcMaskSpellDamage | core.ProcMaskSpellProc | core.ProcMaskMeleeProc | core.ProcMaskRangedProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Permanently attaches Lord Blastington's special scope to a ranged weapon, sometimes increasing Agility
	// by 1800 for 10s when dealing damage with ranged attacks.
	//
	// Attaching this scope to a ranged weapon causes it to become soulbound.
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Lord Blastington's Scope of Doom",
		EnchantID:          4699,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: true,
	})

	// Permanently attaches a mirrored scope to a ranged weapon, sometimes increases critical strike by 900 for
	// 10s when dealing damage with ranged attacks.
	//
	// Attaching this scope to a ranged weapon causes it to become soulbound.
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Mirror Scope",
		EnchantID:          4700,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: true,
	})

	// Embroiders a subtle pattern of light into your cloak, giving you a chance to increase your Intellect by
	// 2000 for 15s when casting a spell.
	//
	// Embroidering your cloak will cause it to become soulbound and requires the Tailoring profession to remain
	// active.
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Lightweave Embroidery (Rank 3)",
		EnchantID:          4892,
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt | core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskSpellDamage | core.ProcMaskSpellHealing | core.ProcMaskSpellProc,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Embroiders a magical pattern into your cloak, giving you a chance to increase your Spirit by 3000 for
	// 15s when you cast a spell.
	//
	// Embroidering your cloak will cause it to become soulbound and requires the Tailoring profession to remain
	// active.
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Darkglow Embroidery (Rank 3)",
		EnchantID:          4893,
		Callback:           core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt | core.CallbackOnHealDealt | core.CallbackOnPeriodicHealDealt,
		ProcMask:           core.ProcMaskSpellDamage | core.ProcMaskSpellHealing,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: false,
	})

	// Embroiders a magical pattern into your cloak, causing your damaging melee and ranged attacks to sometimes
	// increase your attack power by 4000 for 15s.
	//
	// Embroidering your cloak will cause it to become soulbound and requires the Tailoring profession to remain
	// active.
	shared.NewProcStatBonusEffect(shared.ProcStatBonusEffect{
		Name:               "Swordguard Embroidery (Rank 3)",
		EnchantID:          4894,
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeMHAuto | core.ProcMaskMeleeOHAuto | core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeOHSpecial | core.ProcMaskRangedAuto | core.ProcMaskRangedSpecial,
		Outcome:            core.OutcomeLanded,
		RequireDamageDealt: true,
	})

	// OnUseEnchants

	// Phase Fingers: map[9:2880] for 10000ms, 60000ms cooldown, category 1141
	shared.NewActiveStatBonusEffect(shared.ActiveStatBonusEffect{
		EnchantID:          4697,
		RequiredProfession: proto.Profession_Engineering,
	})

	// Skipped
	// Not simulated: Goblin Glider: "Goblin Glider" (126389) - ignored aura type 105
	// https://www.wowhead.com/mop/spell=126389
	// Not simulated: Watergliding Jets: "Watergliding Jets" (131459) - ignored aura type 104
	// https://www.wowhead.com/mop/spell=131459
}
