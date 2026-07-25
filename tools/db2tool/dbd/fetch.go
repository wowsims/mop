// Fetch-and-cache for .dbd definitions: fetch from WoWDBDefs master into a
// gitignored cache directory with a 24h-mtime freshness rule. The .dbd files
// themselves are CC BY-SA 4.0 DATA and are deliberately cached, never
// vendored.

package dbd

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

const dbdURLFormat = "https://raw.githubusercontent.com/wowdev/WoWDBDefs/master/definitions/%s.dbd"

// httpClient bounds the fetch so a stalled connection cannot hang make db
// indefinitely; the fallback to a cached copy handles the timeout.
var httpClient = &http.Client{Timeout: 60 * time.Second}

// FetchCached returns the path to a cached .dbd for tableName under cacheDir,
// fetching from WoWDBDefs when the cached copy is absent or older than 24h.
// On a failed refresh of an existing copy, the stale copy is used; a missing
// copy that cannot be fetched is fatal.
func FetchCached(cacheDir, tableName string) (string, error) {
	if err := os.MkdirAll(cacheDir, 0o755); err != nil {
		return "", err
	}
	path := filepath.Join(cacheDir, tableName+".dbd")
	info, statErr := os.Stat(path)
	if statErr == nil && time.Since(info.ModTime()) < 24*time.Hour {
		return path, nil
	}
	url := fmt.Sprintf(dbdURLFormat, tableName)
	if err := download(url, path); err != nil {
		if statErr == nil {
			fmt.Fprintf(os.Stderr, "db2tool: refresh of %s failed (%v), using cached copy\n", tableName+".dbd", err)
			return path, nil
		}
		return "", fmt.Errorf("fetching %s: %w", url, err)
	}
	return path, nil
}

func download(url, path string) error {
	resp, err := httpClient.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %s", resp.Status)
	}
	tmp := path + ".tmp"
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
	return os.Rename(tmp, path)
}
