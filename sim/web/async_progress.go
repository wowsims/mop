package main

import (
	"sync"
	"sync/atomic"

	uuid "github.com/google/uuid"
	proto "github.com/wowsims/mop/sim/core/proto"
)

type asyncProgress struct {
	id             string
	latestProgress atomic.Value
	pendingMu      sync.Mutex
	// Buffered partial bulk reforge candidates that have not yet been delivered
	// to an asyncProgress poll response.
	pendingOptimizedCandidates []*proto.BulkGearCandidate
	pendingCandidateIndices    map[int32]struct{}
	// Candidate indices already delivered to the client via incremental
	// OptimizedCandidates progress payloads.
	deliveredCandidateIndices map[int32]struct{}
}

func (s *server) addNewSim() *asyncProgress {
	newID := uuid.NewString()
	simProgress := &asyncProgress{
		id:                        newID,
		pendingCandidateIndices:   make(map[int32]struct{}),
		deliveredCandidateIndices: make(map[int32]struct{}),
	}
	simProgress.latestProgress.Store(&proto.ProgressMetrics{})

	s.progMut.Lock()
	s.asyncProgresses[newID] = simProgress
	s.progMut.Unlock()

	return simProgress
}

func (p *asyncProgress) appendPendingOptimizedCandidates(candidates []*proto.BulkGearCandidate) {
	if len(candidates) == 0 {
		return
	}

	p.pendingMu.Lock()
	defer p.pendingMu.Unlock()
	for _, candidate := range candidates {
		if candidate == nil || candidate.Gear == nil {
			continue
		}
		if _, delivered := p.deliveredCandidateIndices[candidate.Index]; delivered {
			continue
		}
		if _, exists := p.pendingCandidateIndices[candidate.Index]; exists {
			continue
		}
		p.pendingCandidateIndices[candidate.Index] = struct{}{}
		p.pendingOptimizedCandidates = append(p.pendingOptimizedCandidates, candidate)
	}
}

func (p *asyncProgress) takePendingOptimizedCandidates() []*proto.BulkGearCandidate {
	p.pendingMu.Lock()
	defer p.pendingMu.Unlock()
	if len(p.pendingOptimizedCandidates) == 0 {
		return nil
	}

	pending := p.pendingOptimizedCandidates
	for _, candidate := range pending {
		if candidate == nil {
			continue
		}
		p.deliveredCandidateIndices[candidate.Index] = struct{}{}
	}
	p.pendingOptimizedCandidates = nil
	p.pendingCandidateIndices = make(map[int32]struct{})
	return pending
}

func (p *asyncProgress) filterUndeliveredOptimizedCandidates(candidates []*proto.BulkGearCandidate) []*proto.BulkGearCandidate {
	if len(candidates) == 0 {
		return nil
	}

	p.pendingMu.Lock()
	defer p.pendingMu.Unlock()
	filtered := make([]*proto.BulkGearCandidate, 0, len(candidates))
	for _, candidate := range candidates {
		if candidate == nil || candidate.Gear == nil {
			continue
		}
		if _, delivered := p.deliveredCandidateIndices[candidate.Index]; delivered {
			continue
		}
		if _, pending := p.pendingCandidateIndices[candidate.Index]; pending {
			continue
		}
		filtered = append(filtered, candidate)
	}
	return filtered
}
