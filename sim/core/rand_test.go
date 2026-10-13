package core

import (
	"math"
	"testing"
	"time"

	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/simsignals"
)

func TestSplitMix64(t *testing.T) {
	x := SplitMix64{state: 1234567}
	min, max := 1.0, 0.0
	distribution := make([]int, 500)
	n := 100_000_000
	for i := 0; i < n; i++ {
		f := x.NextFloat64()
		if f < min {
			min = f
		}
		if f > max {
			max = f
		}
		distribution[int(math.Trunc(f*500))]++
	}
	if min < 0 || max >= 1 {
		t.Fatalf("min = %f < 0 || max = %f >= 1", min, max)
	}
	e := float64(n) / 500
	var chiSquare float64
	for _, v := range distribution {
		chiSquare += (float64(v) - e) * (float64(v) - e) / e
	}
	if chiSquare > 540.93 {
		t.Fatalf("fails chi-square (k = 500) at a = 0.1 (%.1f >= 540.93)", chiSquare)
	}
	t.Logf("chiSquare = %.1f", chiSquare)
}

var result float64

func BenchmarkRnds(b *testing.B) {
	r := NewGoRand(444)
	b.Run("GoRand", func(b *testing.B) {
		b.ReportAllocs()
		var sum float64
		for i := 0; i < b.N; i++ {
			sum += r.NextFloat64()
			sum += r.NextFloat64()
			sum += r.NextFloat64()
			sum += r.NextFloat64()
			sum += r.NextFloat64()
		}
		result += sum
	})

	b.Run("GoRandSetup", func(b *testing.B) {
		b.ReportAllocs()
		var sum float64
		for i := 0; i < b.N; i++ {
			r := NewGoRand(444 + uint64(i))
			sum += r.NextFloat64()
			r = NewGoRand(555 + uint64(i))
			sum += r.NextFloat64()
			r = NewGoRand(666 + uint64(i))
			sum += r.NextFloat64()
			r = NewGoRand(777 + uint64(i))
			sum += r.NextFloat64()
			r = NewGoRand(888 + uint64(i))
			sum += r.NextFloat64()
		}
		result += sum
	})

	sm := NewSplitMix(444)
	b.Run("SplitMix64", func(b *testing.B) {
		b.ReportAllocs()
		var sum float64
		for i := 0; i < b.N; i++ {
			sum += sm.NextFloat64()
			sum += sm.NextFloat64()
			sum += sm.NextFloat64()
			sum += sm.NextFloat64()
			sum += sm.NextFloat64()
		}
		result += sum
	})

	b.Run("SplitMix64Setup", func(b *testing.B) {
		b.ReportAllocs()
		var sum float64
		for i := 0; i < b.N; i++ {
			sm := NewSplitMix(444 + uint64(i))
			sum += sm.NextFloat64()
			sm = NewSplitMix(555 + uint64(i))
			sum += sm.NextFloat64()
			sm = NewSplitMix(666 + uint64(i))
			sum += sm.NextFloat64()
			sm = NewSplitMix(777 + uint64(i))
			sum += sm.NextFloat64()
			sm = NewSplitMix(888 + uint64(i))
			sum += sm.NextFloat64()
		}
		result += sum
	})

	b.Run("Addition", func(b *testing.B) {
		var sum float64
		for i := 0; i < b.N; i++ {
			sum += 3.14159
			sum += 3.14159
			sum += 3.14159
			sum += 3.14159
			sum += 3.14159
		}
		result += sum
	})
}

func TestRandomSeedZeroResolution(t *testing.T) {
	opts1 := &proto.SimOptions{RandomSeed: 0}
	sim1 := newSimWithEnv(&Environment{}, opts1, simsignals.CreateSignals())
	if opts1.RandomSeed == 0 {
		t.Fatalf("expected non-zero RandomSeed on proto, got 0")
	}
	if sim1.Options.RandomSeed == 0 {
		t.Fatalf("expected non-zero sim.Options.RandomSeed, got 0")
	}

	time.Sleep(2 * time.Millisecond)

	opts2 := &proto.SimOptions{RandomSeed: 0}
	sim2 := newSimWithEnv(&Environment{}, opts2, simsignals.CreateSignals())
	if opts2.RandomSeed == opts1.RandomSeed {
		t.Fatalf("expected distinct seeds, got %d and %d", opts1.RandomSeed, opts2.RandomSeed)
	}
	if sim2.Options.RandomSeed == sim1.Options.RandomSeed {
		t.Fatalf("expected distinct sim.Options seeds, got %d and %d", sim1.Options.RandomSeed, sim2.Options.RandomSeed)
	}
}

func TestSplitSimRequestForConcurrencyRandomSeedZero(t *testing.T) {
	req := &proto.RaidSimRequest{
		SimOptions: &proto.SimOptions{
			Iterations: 100,
			RandomSeed: 0,
		},
	}
	res := SplitSimRequestForConcurrency(req, 2)
	if req.SimOptions.RandomSeed == 0 {
		t.Fatalf("expected non-zero resolved RandomSeed, got 0")
	}
	if len(res.Requests) != 2 {
		t.Fatalf("expected 2 requests, got %d", len(res.Requests))
	}
	if res.Requests[0].SimOptions.RandomSeed == 0 {
		t.Fatalf("expected non-zero split 0 seed")
	}
	if res.Requests[1].SimOptions.RandomSeed == 0 {
		t.Fatalf("expected non-zero split 1 seed")
	}
	if res.Requests[0].SimOptions.RandomSeed == res.Requests[1].SimOptions.RandomSeed {
		t.Fatalf("expected different seeds for splits, got %d", res.Requests[0].SimOptions.RandomSeed)
	}
}

func TestFixedRandomSeedPreserved(t *testing.T) {
	opts := &proto.SimOptions{RandomSeed: 12345}
	sim := newSimWithEnv(&Environment{}, opts, simsignals.CreateSignals())
	if opts.RandomSeed != 12345 {
		t.Fatalf("expected RandomSeed to remain 12345, got %d", opts.RandomSeed)
	}
	if sim.Options.RandomSeed != 12345 {
		t.Fatalf("expected sim.Options.RandomSeed to remain 12345, got %d", sim.Options.RandomSeed)
	}
}
