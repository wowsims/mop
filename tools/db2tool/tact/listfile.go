// Go translation of TACTSharp's Listfile download/freshness logic
// (https://github.com/wowdev/TACTSharp, v0.0.13-alpha, commit
// d0ab516eb98b5db35682467b6e4977d88955046d).
// Copyright (c) 2024 Martin Benjamins. MIT License — see tools/db2tool/NOTICES.md.
package tact

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

const DefaultListfileURL = "https://github.com/wowdev/wow-listfile/releases/latest/download/community-listfile.csv"

// Listfile manages the community listfile.csv: download-if-stale semantics
// matching upstream (HEAD + Last-Modified vs local mtime; on a failed
// freshness check upstream re-downloads, and on a failed download it falls
// back to the existing file when one exists).
type Listfile struct {
	Path   string
	URL    string
	byPath map[string]uint32
}

// Refresh ensures the listfile exists and is current. It never deletes a
// usable existing file on network failure — the extractor (via the static
// FDID map) and gen_db's icon map can still run offline.
func (l *Listfile) Refresh() error {
	url := l.URL
	if url == "" {
		url = DefaultListfileURL
	}
	info, statErr := os.Stat(l.Path)
	if statErr == nil {
		resp, err := http.Head(url)
		if err == nil {
			lastModified, perr := time.Parse(http.TimeFormat, resp.Header.Get("Last-Modified"))
			resp.Body.Close()
			if perr == nil && !lastModified.After(info.ModTime().UTC()) {
				return nil // up to date
			}
		}
		// Stale or check failed: attempt a re-download, but keep the existing
		// file if that fails.
		if err := l.download(url); err != nil {
			fmt.Fprintf(os.Stderr, "db2tool: listfile refresh failed (%v), using existing %s\n", err, l.Path)
		}
		return nil
	}
	// No local file: the download must succeed.
	if err := l.download(url); err != nil {
		return fmt.Errorf("downloading listfile: %w", err)
	}
	return nil
}

func (l *Listfile) download(url string) error {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %s", resp.Status)
	}
	tmp := l.Path + ".tmp"
	f, err := os.Create(tmp)
	if err != nil {
		return err
	}
	if _, err := io.Copy(f, resp.Body); err != nil {
		f.Close()
		os.Remove(tmp)
		return err
	}
	if err := f.Close(); err != nil {
		os.Remove(tmp)
		return err
	}
	return os.Rename(tmp, l.Path)
}
