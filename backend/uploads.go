package main

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
)

var allowedImageTypes = map[string]string{
	"image/jpeg":    ".jpg",
	"image/png":     ".png",
	"image/webp":    ".webp",
	"image/svg+xml": ".svg",
}

const maxImageUploadBytes = 5 << 20 // 5MB

// handleUploadItemImage stores a menu item's photo on disk and points the
// item's image_url at it. Images live outside the database so the storefront
// can load them as plain <img> requests against the API origin.
func (s *server) handleUploadItemImage(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid item id")
		return
	}

	if _, err := fetchItem(s.db, id); err != nil {
		writeError(w, http.StatusNotFound, "item not found")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxImageUploadBytes)
	file, _, err := r.FormFile("image")
	if err != nil {
		writeError(w, http.StatusBadRequest, "missing image file")
		return
	}
	defer file.Close()

	buf := make([]byte, 512)
	n, _ := io.ReadFull(file, buf)
	contentType := sniffImageType(buf[:n])
	ext, ok := allowedImageTypes[contentType]
	if !ok {
		writeError(w, http.StatusBadRequest, "image must be JPEG, PNG, WebP or SVG")
		return
	}

	nameBytes := make([]byte, 8)
	if _, err := rand.Read(nameBytes); err != nil {
		writeError(w, http.StatusInternalServerError, "could not generate file name")
		return
	}
	filename := fmt.Sprintf("item-%d-%s%s", id, hex.EncodeToString(nameBytes), ext)

	dst, err := os.Create(filepath.Join(s.uploadsDir, filename))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not save image")
		return
	}
	defer dst.Close()

	if _, err := dst.Write(buf[:n]); err != nil {
		writeError(w, http.StatusInternalServerError, "could not save image")
		return
	}
	if _, err := io.Copy(dst, file); err != nil {
		writeError(w, http.StatusInternalServerError, "could not save image")
		return
	}

	imageURL := "/uploads/" + filename
	if _, err := s.db.Exec(`UPDATE items SET image_url = $1 WHERE id = $2`, imageURL, id); err != nil {
		writeError(w, http.StatusInternalServerError, "could not update item")
		return
	}

	item, err := fetchItem(s.db, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not read updated item")
		return
	}

	writeJSON(w, http.StatusOK, item)
}

// sniffImageType detects JPEG/PNG/WebP the normal way. SVG is XML text, so
// http.DetectContentType never returns "image/svg+xml" for it — this checks
// for that case separately.
func sniffImageType(buf []byte) string {
	if ct := http.DetectContentType(buf); ct != "text/plain; charset=utf-8" && ct != "text/xml; charset=utf-8" {
		return ct
	}
	if looksLikeSVG(buf) {
		return "image/svg+xml"
	}
	return http.DetectContentType(buf)
}

func looksLikeSVG(buf []byte) bool {
	trimmed := bytes.TrimLeft(buf, "\xef\xbb\xbf \t\r\n")
	lower := bytes.ToLower(trimmed)
	if bytes.HasPrefix(lower, []byte("<?xml")) {
		if i := bytes.IndexByte(trimmed, '>'); i != -1 {
			trimmed = bytes.TrimLeft(trimmed[i+1:], " \t\r\n")
			lower = bytes.ToLower(trimmed)
		}
	}
	return bytes.HasPrefix(lower, []byte("<svg"))
}
