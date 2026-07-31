package dbc

type Spell struct {
	NameLang              string
	ID                    int32
	SchoolMask            int32
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
	CategoryRecoveryTime  int32
	GCD                   int32
	MinRange              float32
	MaxRange              float32
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
	SpellProcsPerMinute   float32
	EquippedItemClass     int32
	EquippedItemInvTypes  int32
	EquippedItemSubclass  int32
	CastTimeMin           float32
	SpellClassMask        []int
	SpellClassSet         int32
	AuraInterruptFlags    []int
	ChannelInterruptFlags []int
	ShapeshiftMask        []int
	Description           string
	Variables             string
	MaxCumulativeStacks   int32
	MaxTargets            int32
	IconPath              string
	RppmModifiers         []RPPMModifier
}

type RPPMModifier struct {
	ModifierType RPPMModifierType
	Coeff        float64
	Param        int32
}

func (s *Spell) HasAttributeAt(index int, flag int) bool {
	if index < 0 || index >= len(s.Attributes) {
		return false
	}
	return (s.Attributes[index] & flag) != 0
}

// Reports whether the spell's effect amounts come from the item level of the item carrying it
// rather than from a class curve. On such an effect EffectBasePoints is a stale snapshot and
// only the scaling coefficient resolves the real amount.
func (s *Spell) ScalesWithItemLevel() bool {
	return s.HasAttributeAt(ATTR_INDEX_EX_11, ATTR_EX_11_SCALES_WITH_ITEM_LEVEL)
}

// Reports whether the spell is suppressed while challenge mode scaling applies.
func (s *Spell) NotActiveInChallengeMode() bool {
	return s.HasAttributeAt(ATTR_INDEX_EX_11, ATTR_EX_11_NOT_ACTIVE_IN_CHALLENGE_MODE)
}

// Reports whether the spell may be triggered by another proc, which decides whether the proc
// masks carry their ...Proc bits.
func (s *Spell) CanProcFromProcs() bool {
	return s.HasAttributeAt(ATTR_INDEX_EX_3, ATTR_EX_3_CAN_PROC_FROM_PROCS)
}
