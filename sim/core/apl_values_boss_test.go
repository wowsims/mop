package core

import (
	"testing"
	"time"

	"github.com/wowsims/mop/sim/core/proto"
)

func setupBossCastSpell(t *testing.T, castTime time.Duration) (*APLRotation, *Unit, *Spell) {
	t.Helper()
	sim := SetupFakeSim()
	playerUnit := &sim.Raid.Parties[0].Players[0].GetCharacter().Unit
	bossUnit := sim.Encounter.AllTargetUnits[0]

	spell := bossUnit.RegisterSpell(SpellConfig{
		ActionID: ActionID{SpellID: 90210},
		Cast: CastConfig{
			DefaultCast: Cast{
				CastTime: castTime,
			},
		},
	})

	rot := &APLRotation{
		unit:            playerUnit,
		uuidValidations: make(map[*proto.UUID][]*proto.APLValidation),
	}

	return rot, bossUnit, spell
}

func bossTargetRef() *proto.UnitReference {
	return &proto.UnitReference{Type: proto.UnitReference_Target, Index: 0}
}

func TestBossSpellCastTimeRemaining(t *testing.T) {
	rot, bossUnit, spell := setupBossCastSpell(t, 3*time.Second)

	value := rot.newValueBossSpellCastTimeRemaining(&proto.APLValueBossSpellCastTimeRemaining{
		TargetUnit: bossTargetRef(),
		SpellId:    spell.ActionID.ToProto(),
	}, &proto.UUID{Value: "a"})
	if value == nil {
		t.Fatalf("expected non-nil value")
	}

	fakeSim := &Simulation{CurrentTime: 10 * time.Second}

	// Not casting: remaining time is 0.
	bossUnit.Hardcast = Hardcast{}
	if got := value.GetDuration(fakeSim); got != 0 {
		t.Fatalf("expected 0 remaining when not casting, got %s", got)
	}

	// Casting this spell with 2s left.
	bossUnit.Hardcast = Hardcast{ActionID: spell.ActionID, Expires: fakeSim.CurrentTime + 2*time.Second}
	if got := value.GetDuration(fakeSim); got != 2*time.Second {
		t.Fatalf("expected 2s remaining, got %s", got)
	}

	// Casting a different spell: remaining time is 0.
	bossUnit.Hardcast = Hardcast{ActionID: ActionID{SpellID: 1}, Expires: fakeSim.CurrentTime + 2*time.Second}
	if got := value.GetDuration(fakeSim); got != 0 {
		t.Fatalf("expected 0 remaining for a different spell, got %s", got)
	}

	// Matching spell, but the cast already finished: remaining time is 0.
	bossUnit.Hardcast = Hardcast{ActionID: spell.ActionID, Expires: fakeSim.CurrentTime - time.Second}
	if got := value.GetDuration(fakeSim); got != 0 {
		t.Fatalf("expected 0 remaining for a stale finished cast, got %s", got)
	}

	// Matching spell, expiring exactly now: remaining time is 0 (Expires is exclusive).
	bossUnit.Hardcast = Hardcast{ActionID: spell.ActionID, Expires: fakeSim.CurrentTime}
	if got := value.GetDuration(fakeSim); got != 0 {
		t.Fatalf("expected 0 remaining at the exact expiry boundary, got %s", got)
	}
}

// Locks the bossHardcastRemaining refactor: BossSpellIsCasting must agree with
// CastTimeRemaining > 0 across every Hardcast state, since both now derive from
// the same helper.
func TestBossSpellIsCasting_AgreesWithCastTimeRemaining(t *testing.T) {
	rot, bossUnit, spell := setupBossCastSpell(t, 3*time.Second)

	remainingValue := rot.newValueBossSpellCastTimeRemaining(&proto.APLValueBossSpellCastTimeRemaining{
		TargetUnit: bossTargetRef(),
		SpellId:    spell.ActionID.ToProto(),
	}, &proto.UUID{Value: "a"})
	isCastingValue := rot.newValueBossSpellIsCasting(&proto.APLValueBossSpellIsCasting{
		TargetUnit: bossTargetRef(),
		SpellId:    spell.ActionID.ToProto(),
	}, &proto.UUID{Value: "b"})
	if remainingValue == nil || isCastingValue == nil {
		t.Fatalf("expected both values to be non-nil")
	}

	fakeSim := &Simulation{CurrentTime: 10 * time.Second}
	states := []Hardcast{
		{},
		{ActionID: spell.ActionID, Expires: fakeSim.CurrentTime + 2*time.Second},
		{ActionID: ActionID{SpellID: 1}, Expires: fakeSim.CurrentTime + 2*time.Second},
		{ActionID: spell.ActionID, Expires: fakeSim.CurrentTime - time.Second},
		{ActionID: spell.ActionID, Expires: fakeSim.CurrentTime},
	}
	for _, state := range states {
		bossUnit.Hardcast = state
		remaining := remainingValue.GetDuration(fakeSim)
		isCasting := isCastingValue.GetBool(fakeSim)
		if (remaining > 0) != isCasting {
			t.Fatalf("disagreement for Hardcast %+v: remaining=%s isCasting=%v", state, remaining, isCasting)
		}
	}
}

func TestBossSpellCastTimeRemaining_RejectsSpellWithoutCastTime(t *testing.T) {
	rot, _, spell := setupBossCastSpell(t, 0)

	uuid := &proto.UUID{Value: "no-cast-time"}
	value := rot.newValueBossSpellCastTimeRemaining(&proto.APLValueBossSpellCastTimeRemaining{
		TargetUnit: bossTargetRef(),
		SpellId:    spell.ActionID.ToProto(),
	}, uuid)
	if value != nil {
		t.Fatalf("expected nil value for a spell with no cast time")
	}

	warnings := rot.uuidValidations[uuid]
	if len(warnings) != 1 || warnings[0].LogLevel != proto.LogLevel_Warning {
		t.Fatalf("expected exactly one warning validation, got %v", warnings)
	}
}
