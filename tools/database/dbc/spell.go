package dbc

import (
	"github.com/wowsims/mop/sim/core/proto"
)

type Spell struct {
	NameLang              string
	ID                    int32
	SchoolMask            DamageClass
	Speed                 float32
	LaunchDelay           float32
	MinDuration           float32
	MaxScalingLevel       int
	MinScalingLevel       int32
	ScalesFromItemLevel   int32
	SpellLevel            int
	BaseLevel             int32
	MaxLevel              int
	MaxPassiveAuraLevel   int32
	Cooldown              int32
	GCD                   int32
	RangeIndex            int32
	Attributes            []int
	CategoryFlags         int32
	MaxCharges            int32
	ChargeRecoveryTime    int32
	CategoryTypeMask      int32
	Category              int32
	Duration              int32
	ProcChance            float32
	ProcCharges           int32
	ProcTypeMask          []int
	ProcCategoryRecovery  int32
	SpellProcsPerMinuteID int32
	EquippedItemClass     int32
	EquippedItemInvTypes  int32
	EquippedItemSubclass  int32
	CastTimeMin           float32
	SpellClassMask        []int
	SpellClassSet         int32
	AuraInterruptFlags    []int
	ChannelInterruptFlags []int
	ShapeshiftMask        []int
	SpellEffects          []int
	MinRange              int
	MaxRange              int
}

func (s *Spell) ToProto() *proto.Spell {
	spell := &proto.Spell{}
	spellPower := dbcInstance.SpellPowerBySpell[int(s.ID)]
	spell.BaseCost = spellPower.GetCost()
	spell.MissileSpeed = float64(s.Speed)
	spell.Id = s.ID
	spell.Cooldown = s.Cooldown
	spell.Gcd = s.GCD
	spell.BaseCastTime = int32(s.CastTimeMin)
	spell.Resource = spellPower.GetPowerType()
	spell.MinRange = int32(s.MinRange)
	spell.MaxRange = int32(s.MaxRange)
	spell.SpellEffects = ConvertInts[int32](s.SpellEffects)
	spell.School = int32(s.SchoolMask.ToSpellSchool())
	return spell
}

func (s *Spell) HasAttributeFlag(attr uint) bool {
	bit := attr % 32
	index := attr / 32
	if index >= uint(len(s.Attributes)) {
		return false
	}
	return (s.Attributes[index] & (1 << bit)) != 0
}
