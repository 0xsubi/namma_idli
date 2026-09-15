package main

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5/pgconn"
)

// validItemStatuses are the states an admin can put a menu item in. The
// storefront greys out and blocks ordering for anything but "available".
var validItemStatuses = map[string]bool{
	"available":   true,
	"sold_out":    true,
	"unavailable": true,
	"coming_soon": true,
}

func (s *server) handleCreateItem(w http.ResponseWriter, r *http.Request) {
	var req ItemRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	if req.Name == "" || req.Price < 0 {
		writeError(w, http.StatusBadRequest, "name is required and price must be >= 0")
		return
	}
	if req.Status == "" {
		req.Status = "available"
	}
	if !validItemStatuses[req.Status] {
		writeError(w, http.StatusBadRequest, "status must be one of available, sold_out, unavailable, coming_soon")
		return
	}

	var id int64
	err := s.db.QueryRow(
		`INSERT INTO items (name, price, description, status) VALUES ($1, $2, $3, $4) RETURNING id`,
		req.Name, req.Price, req.Description, req.Status,
	).Scan(&id)
	if isUniqueConstraintErr(err) {
		writeError(w, http.StatusConflict, "an item with this name already exists")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create item")
		return
	}

	item, err := fetchItem(s.db, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not read created item")
		return
	}

	writeJSON(w, http.StatusCreated, item)
}

func (s *server) handleListItems(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(`SELECT id, name, price, description, image_url, status, created_at FROM items ORDER BY name`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list items")
		return
	}
	defer rows.Close()

	items := []Item{}
	for rows.Next() {
		var it Item
		if err := rows.Scan(&it.ID, &it.Name, &it.Price, &it.Description, &it.ImageURL, &it.Status, &it.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "could not read items")
			return
		}
		items = append(items, it)
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *server) handleUpdateItem(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid item id")
		return
	}

	var req ItemRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	if req.Name == "" || req.Price < 0 {
		writeError(w, http.StatusBadRequest, "name is required and price must be >= 0")
		return
	}
	if req.Status == "" {
		req.Status = "available"
	}
	if !validItemStatuses[req.Status] {
		writeError(w, http.StatusBadRequest, "status must be one of available, sold_out, unavailable, coming_soon")
		return
	}

	res, err := s.db.Exec(
		`UPDATE items SET name = $1, price = $2, description = $3, status = $4 WHERE id = $5`,
		req.Name, req.Price, req.Description, req.Status, id,
	)
	if isUniqueConstraintErr(err) {
		writeError(w, http.StatusConflict, "an item with this name already exists")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update item")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "item not found")
		return
	}

	item, err := fetchItem(s.db, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not read updated item")
		return
	}

	writeJSON(w, http.StatusOK, item)
}

func (s *server) handleDeleteItem(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid item id")
		return
	}

	res, err := s.db.Exec(`DELETE FROM items WHERE id = $1`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not delete item")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "item not found")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func fetchItem(db *sql.DB, id int64) (Item, error) {
	var it Item
	err := db.QueryRow(
		`SELECT id, name, price, description, image_url, status, created_at FROM items WHERE id = $1`, id,
	).Scan(&it.ID, &it.Name, &it.Price, &it.Description, &it.ImageURL, &it.Status, &it.CreatedAt)
	return it, err
}

// isUniqueConstraintErr reports whether err is a Postgres unique_violation (23505).
func isUniqueConstraintErr(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
