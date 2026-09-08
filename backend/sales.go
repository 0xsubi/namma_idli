package main

import (
	"net/http"
	"strconv"
	"time"
)

func (s *server) handleCreateSale(w http.ResponseWriter, r *http.Request) {
	var req CreateSaleRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	if req.Amount <= 0 {
		writeError(w, http.StatusBadRequest, "amount must be > 0")
		return
	}
	if req.SaleDate == "" {
		req.SaleDate = time.Now().UTC().Format("2006-01-02")
	} else if _, err := time.Parse("2006-01-02", req.SaleDate); err != nil {
		writeError(w, http.StatusBadRequest, "sale_date must be in YYYY-MM-DD format")
		return
	}

	var id int64
	err := s.db.QueryRow(
		`INSERT INTO sales (sale_date, amount, notes) VALUES ($1, $2, $3) RETURNING id`,
		req.SaleDate, req.Amount, req.Notes,
	).Scan(&id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create sale")
		return
	}

	writeJSON(w, http.StatusCreated, Sale{
		ID:        id,
		SaleDate:  req.SaleDate,
		Amount:    req.Amount,
		Notes:     req.Notes,
		CreatedAt: time.Now().UTC(),
	})
}

func (s *server) handleListSales(w http.ResponseWriter, r *http.Request) {
	from, to := dateRange(r)

	limit := 100
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			limit = n
		}
	}

	rows, err := s.db.Query(
		`SELECT id, sale_date, amount, notes, created_at FROM sales WHERE sale_date BETWEEN $1 AND $2 ORDER BY sale_date DESC, id DESC LIMIT $3`,
		from, to, limit,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list sales")
		return
	}
	defer rows.Close()

	sales := []Sale{}
	for rows.Next() {
		var rec Sale
		if err := rows.Scan(&rec.ID, &rec.SaleDate, &rec.Amount, &rec.Notes, &rec.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "could not read sales")
			return
		}
		sales = append(sales, rec)
	}
	writeJSON(w, http.StatusOK, sales)
}
