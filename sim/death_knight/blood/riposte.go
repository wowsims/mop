package blood

import (
	"github.com/wowsims/mop/sim/common/shared"
)

func (bdk *BloodDeathKnight) registerRiposte() {
	bdk.RiposteAura = shared.RegisterRiposteEffect(&bdk.Character, 145677, 145676)
}
