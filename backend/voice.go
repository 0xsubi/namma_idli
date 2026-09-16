package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

type VoiceParseRequest struct {
	Transcript string `json:"transcript"`
}

type VoiceLine struct {
	ItemID   int64  `json:"item_id"`
	ItemName string `json:"item_name"`
	Quantity int    `json:"quantity"`
}

type VoiceParseResponse struct {
	Transcript string      `json:"transcript"`
	Lines      []VoiceLine `json:"lines"`
	Confident  bool        `json:"confident"`
}

type ollamaGenerateRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
	Format string `json:"format"`
	Stream bool   `json:"stream"`
}

type ollamaGenerateResponse struct {
	Response string `json:"response"`
}

type ollamaOrderLine struct {
	ItemName string `json:"item_name"`
	Quantity int    `json:"quantity"`
}

// handleVoiceParse is the fallback for spoken orders the admin app's
// on-device deterministic parser couldn't confidently resolve. It asks a
// locally-hosted Ollama model (OLLAMA_URL) to match the transcript against
// the current menu — free and private since it never leaves the LAN, but it
// needs Ollama actually running somewhere reachable, so a missing/unreachable
// OLLAMA_URL degrades to a clear error rather than a fabricated match.
func (s *server) handleVoiceParse(w http.ResponseWriter, r *http.Request) {
	var req VoiceParseRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	if strings.TrimSpace(req.Transcript) == "" {
		writeError(w, http.StatusBadRequest, "transcript is required")
		return
	}

	ollamaURL := os.Getenv("OLLAMA_URL")
	if ollamaURL == "" {
		writeError(w, http.StatusServiceUnavailable, "voice parsing fallback isn't configured (OLLAMA_URL not set)")
		return
	}
	model := os.Getenv("OLLAMA_MODEL")
	if model == "" {
		model = "llama3.2:3b"
	}

	rows, err := s.db.Query(`SELECT id, name FROM items WHERE status != 'unavailable' ORDER BY name`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load menu")
		return
	}
	defer rows.Close()

	var names []string
	byName := map[string]int64{}
	for rows.Next() {
		var id int64
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			writeError(w, http.StatusInternalServerError, "could not read menu")
			return
		}
		names = append(names, name)
		byName[strings.ToLower(name)] = id
	}
	if len(names) == 0 {
		writeError(w, http.StatusBadRequest, "no menu items to match against")
		return
	}

	prompt := fmt.Sprintf(`You are parsing a spoken restaurant order into structured line items.
Menu items (use these exact names, case-sensitive): %s

Spoken order: %q

Return a JSON array of objects, each with "item_name" (must be exactly one of the menu items above) and "quantity" (a positive integer). Skip anything in the spoken order that doesn't match a menu item. If nothing matches, return an empty array. Return ONLY the JSON array, nothing else.`,
		strings.Join(names, ", "), req.Transcript,
	)

	body, err := json.Marshal(ollamaGenerateRequest{
		Model:  model,
		Prompt: prompt,
		Format: "json",
		Stream: false,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not build parse request")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(ollamaURL, "/")+"/api/generate", bytes.NewReader(body))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not build parse request")
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, "voice parsing service unreachable: "+err.Error())
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		writeError(w, http.StatusBadGateway, fmt.Sprintf("voice parsing service returned %d", resp.StatusCode))
		return
	}

	var ollamaResp ollamaGenerateResponse
	if err := json.NewDecoder(resp.Body).Decode(&ollamaResp); err != nil {
		writeError(w, http.StatusBadGateway, "could not read voice parsing response")
		return
	}

	// The model occasionally wraps the array in an object (e.g. {"items":
	// [...]}) despite instructions, so try both shapes before giving up.
	var parsedLines []ollamaOrderLine
	if err := json.Unmarshal([]byte(ollamaResp.Response), &parsedLines); err != nil {
		var wrapped struct {
			Items []ollamaOrderLine `json:"items"`
		}
		if err2 := json.Unmarshal([]byte(ollamaResp.Response), &wrapped); err2 == nil {
			parsedLines = wrapped.Items
		} else {
			writeJSON(w, http.StatusOK, VoiceParseResponse{Transcript: req.Transcript, Lines: []VoiceLine{}, Confident: false})
			return
		}
	}

	lines := []VoiceLine{}
	for _, l := range parsedLines {
		id, ok := byName[strings.ToLower(strings.TrimSpace(l.ItemName))]
		if !ok || l.Quantity <= 0 {
			continue
		}
		lines = append(lines, VoiceLine{ItemID: id, ItemName: l.ItemName, Quantity: l.Quantity})
	}

	writeJSON(w, http.StatusOK, VoiceParseResponse{
		Transcript: req.Transcript,
		Lines:      lines,
		Confident:  len(lines) > 0,
	})
}
