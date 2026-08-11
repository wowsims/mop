// Go translation of TACTSharp's Listfile download/freshness logic
// (https://github.com/wowdev/TACTSharp, v0.0.13-alpha, commit
// d0ab516eb98b5db35682467b6e4977d88955046d).
// Copyright (c) 2024 Martin Benjamins. MIT License — see tools/db2tool/NOTICES.md.

package tact

import (
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"time"
)

const defaultListfileURL = "https://github.com/wowdev/wow-listfile/releases/latest/download/community-listfile.csv"

// headClient bounds the freshness probe; downloadClient bounds connect and
// response-header time but NOT the transfer, since the listfile is ~150 MB and
// a slow-but-progressing download must not be cut off. Without these a stalled
// connection would hang make db indefinitely.
var (
	headClient     = &http.Client{Timeout: 30 * time.Second}
	downloadClient = &http.Client{Transport: &http.Transport{
		DialContext:           (&net.Dialer{Timeout: 30 * time.Second}).DialContext,
		TLSHandshakeTimeout:   30 * time.Second,
		ResponseHeaderTimeout: 60 * time.Second,
	}}
)

// Listfile manages the community listfile.csv with download-if-stale
// semantics: HEAD + Last-Modified vs local mtime; a failed freshness check
// triggers a re-download, and a failed download falls back to the existing
// file when one exists.
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
		url = defaultListfileURL
	}
	info, statErr := os.Stat(l.Path)
	if statErr == nil {
		resp, err := headClient.Head(url)
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
	resp, err := downloadClient.Get(url)
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
