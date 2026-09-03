// Command gen_logs produces combat log fixtures for the UI log-pipeline benchmarks.
//
//	go run -tags with_db ./tools/bench/gen_logs --spec unholy --out tools/bench/logs/unholy.log
//
// Specs are chosen for pet count: the per-pet fan-out in the UI's sim_result.ts is
// invisible on a petless single-target profile.
package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"google.golang.org/protobuf/encoding/protojson"
	googleProto "google.golang.org/protobuf/proto"

	"github.com/wowsims/mop/sim"
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

type specConfig struct {
	class       proto.Class
	race        proto.Race
	gearSetDir  string
	aplDir      string
	talents     string
	glyphs      *proto.Glyphs
	consumables *proto.ConsumesSpec
	specOptions interface{}
	distance    float64
	profession1 proto.Profession
	profession2 proto.Profession
}

var specs = map[string]specConfig{
	"unholy": {
		class:      proto.Class_ClassDeathKnight,
		race:       proto.Race_RaceTroll,
		gearSetDir: "ui/death_knight/unholy/gear_sets",
		aplDir:     "ui/death_knight/unholy/apls",
		talents:    "300010",
		glyphs: &proto.Glyphs{
			Major1: int32(proto.DeathKnightMajorGlyph_GlyphOfRegenerativeMagic),
			Major2: int32(proto.DeathKnightMajorGlyph_GlyphOfPestilence),
			Major3: int32(proto.DeathKnightMajorGlyph_GlyphOfLoudHorn),
		},
		consumables: &proto.ConsumesSpec{FlaskId: 76088, FoodId: 74646, PotId: 76095, PrepotId: 76095},
		specOptions: &proto.Player_UnholyDeathKnight{UnholyDeathKnight: &proto.UnholyDeathKnight{
			Options: &proto.UnholyDeathKnight_Options{
				ClassOptions:      &proto.DeathKnightOptions{},
				AvgAmsHit:         170000,
				AvgAmsSuccessRate: 1,
			},
		}},
		profession1: proto.Profession_Engineering,
		profession2: proto.Profession_Herbalism,
	},
	"demonology": {
		class:      proto.Class_ClassWarlock,
		race:       proto.Race_RaceOrc,
		gearSetDir: "ui/warlock/demonology/gear_sets",
		aplDir:     "ui/warlock/demonology/apls",
		talents:    "231221",
		glyphs: &proto.Glyphs{
			Major1: int32(proto.WarlockMajorGlyph_GlyphOfSoulstone),
			Major2: int32(proto.WarlockMajorGlyph_GlyphOfEternalResolve),
			Major3: int32(proto.WarlockMajorGlyph_GlyphOfImpSwarm),
		},
		consumables: &proto.ConsumesSpec{FlaskId: 76085, FoodId: 74650, PotId: 76093, PrepotId: 76093},
		specOptions: &proto.Player_DemonologyWarlock{DemonologyWarlock: &proto.DemonologyWarlock{
			Options: &proto.DemonologyWarlock_Options{
				ClassOptions: &proto.WarlockOptions{Summon: proto.WarlockOptions_Felguard},
			},
		}},
		distance: 25,
	},
}

func main() {
	specName := flag.String("spec", "unholy", "spec key: unholy | demonology")
	gearSet := flag.String("gear", "p5", "gear set name")
	apl := flag.String("apl", "default", "apl name")
	players := flag.Int("players", 1, "number of copies of the player in the raid (25 for a raid-shaped log)")
	duration := flag.Float64("duration", 300, "encounter duration in seconds")
	seed := flag.Int64("seed", 101, "rng seed")
	outfile := flag.String("out", "", "output file, defaults to stdout")
	jsonOut := flag.String("json", "", "also write {request,result} as protojson here, for the SimResult.makeNew bench")
	flag.Parse()

	cfg, ok := specs[*specName]
	if !ok {
		log.Fatalf("unknown spec %q", *specName)
	}
	sim.RegisterAll()

	player := core.WithSpec(&proto.Player{
		Name:               "Benchmark1",
		Class:              cfg.class,
		Race:               cfg.race,
		Equipment:          core.GetGearSet(cfg.gearSetDir, *gearSet).GearSet,
		Consumables:        cfg.consumables,
		Buffs:              core.FullIndividualBuffs,
		TalentsString:      cfg.talents,
		Glyphs:             cfg.glyphs,
		Profession1:        cfg.profession1,
		Profession2:        cfg.profession2,
		Rotation:           core.GetAplRotation(cfg.aplDir, *apl).Rotation,
		DistanceFromTarget: cfg.distance,
		ReactionTimeMs:     100,
		ChannelClipDelayMs: 50,
	}, cfg.specOptions)

	raid := core.SinglePlayerRaidProto(player, core.FullPartyBuffs, core.FullRaidBuffs, core.FullDebuffs)
	for i := 1; i < *players; i++ {
		partyIdx := i / 5
		for len(raid.Parties) <= partyIdx {
			raid.Parties = append(raid.Parties, &proto.Party{Buffs: core.FullPartyBuffs})
		}
		clone := googleProto.Clone(player).(*proto.Player)
		// Distinct names: the UI splits logs per unit by the name the sim printed.
		clone.Name = fmt.Sprintf("Benchmark%d", i+1)
		raid.Parties[partyIdx].Players = append(raid.Parties[partyIdx].Players, clone)
	}

	encounter := core.MakeSingleTargetEncounter(0)
	encounter.Duration = *duration

	request := &proto.RaidSimRequest{
		Raid:      raid,
		Encounter: encounter,
		SimOptions: &proto.SimOptions{
			Iterations: 1,
			Debug:      true,
			RandomSeed: *seed,
		},
	}
	result := core.RunRaidSim(request)
	if result.Error != nil {
		log.Fatalf("sim failed: %s", result.Error.Message)
	}
	if result.Logs == "" {
		log.Fatal("sim produced no logs")
	}

	if *jsonOut != "" {
		writeBundle(*jsonOut, request, result)
	}

	if *outfile == "" {
		fmt.Print(result.Logs)
		return
	}
	if err := os.WriteFile(*outfile, []byte(result.Logs), 0o644); err != nil {
		log.Fatalf("failed to write %s: %v", *outfile, err)
	}
	fmt.Printf("%s: %d bytes\n", *outfile, len(result.Logs))
}

// writeBundle emits the request and result as protojson so the node bench can rebuild
// both with the UI's own generated proto classes and exercise SimResult.makeNew.
func writeBundle(path string, request *proto.RaidSimRequest, result *proto.RaidSimResult) {
	marshal := protojson.MarshalOptions{}
	reqJson, err := marshal.Marshal(request)
	if err != nil {
		log.Fatalf("failed to marshal request: %v", err)
	}
	resJson, err := marshal.Marshal(result)
	if err != nil {
		log.Fatalf("failed to marshal result: %v", err)
	}

	f, err := os.Create(path)
	if err != nil {
		log.Fatalf("failed to create %s: %v", path, err)
	}
	defer f.Close()
	if _, err := fmt.Fprintf(f, "{\"request\":%s,\"result\":%s}", reqJson, resJson); err != nil {
		log.Fatalf("failed to write %s: %v", path, err)
	}
	fmt.Printf("%s written\n", path)
}
