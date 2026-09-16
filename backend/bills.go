package main

import (
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

func (s *server) handleCreateBill(w http.ResponseWriter, r *http.Request) {
	var req CreateBillRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	if len(req.Items) == 0 {
		writeError(w, http.StatusBadRequest, "bill must have at least one item")
		return
	}
	for _, it := range req.Items {
		hasAmount := it.Amount != nil && *it.Amount > 0
		if it.ItemName == "" || it.UnitPrice < 0 || it.Quantity < 0 || (it.Quantity == 0 && !hasAmount) {
			writeError(w, http.StatusBadRequest, "each item needs item_name, unit_price >= 0, and either quantity > 0 or a direct amount > 0")
			return
		}
	}

	bill, err := insertBill(s.db, req.CustomerName, req.PaymentMethod, req.Items)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create bill")
		return
	}

	writeJSON(w, http.StatusCreated, bill)
}

// insertBill creates a bill and its line items in a single transaction.
// Shared by direct bill creation and order-to-bill conversion.
func insertBill(db *sql.DB, customerName, paymentMethod string, itemsIn []BillItemInput) (Bill, error) {
	var total float64
	items := make([]BillItem, 0, len(itemsIn))
	for _, it := range itemsIn {
		lineTotal := it.UnitPrice * float64(it.Quantity)
		if it.Amount != nil {
			lineTotal = *it.Amount
		}
		total += lineTotal
		items = append(items, BillItem{
			ItemName:  it.ItemName,
			UnitPrice: it.UnitPrice,
			Quantity:  it.Quantity,
			LineTotal: lineTotal,
		})
	}

	tx, err := db.Begin()
	if err != nil {
		return Bill{}, err
	}
	defer tx.Rollback()

	var billID int64
	var createdAt time.Time
	err = tx.QueryRow(
		`INSERT INTO bills (customer_name, payment_method, total_amount) VALUES ($1, $2, $3) RETURNING id, created_at`,
		customerName, paymentMethod, total,
	).Scan(&billID, &createdAt)
	if err != nil {
		return Bill{}, err
	}

	stmt, err := tx.Prepare(`INSERT INTO bill_items (bill_id, item_name, unit_price, quantity, line_total) VALUES ($1, $2, $3, $4, $5) RETURNING id`)
	if err != nil {
		return Bill{}, err
	}
	defer stmt.Close()

	for i := range items {
		if err := stmt.QueryRow(billID, items[i].ItemName, items[i].UnitPrice, items[i].Quantity, items[i].LineTotal).Scan(&items[i].ID); err != nil {
			return Bill{}, err
		}
	}

	if err := tx.Commit(); err != nil {
		return Bill{}, err
	}

	return Bill{
		ID:            billID,
		CustomerName:  customerName,
		PaymentMethod: paymentMethod,
		TotalAmount:   total,
		CreatedAt:     createdAt,
		Items:         items,
	}, nil
}

func (s *server) handleListBills(w http.ResponseWriter, r *http.Request) {
	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			limit = n
		}
	}

	rows, err := s.db.Query(
		`SELECT id, customer_name, payment_method, total_amount, created_at FROM bills ORDER BY id DESC LIMIT $1`,
		limit,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list bills")
		return
	}
	defer rows.Close()

	bills := []Bill{}
	for rows.Next() {
		var b Bill
		if err := rows.Scan(&b.ID, &b.CustomerName, &b.PaymentMethod, &b.TotalAmount, &b.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "could not read bills")
			return
		}
		bills = append(bills, b)
	}
	writeJSON(w, http.StatusOK, bills)
}

func (s *server) handleGetBill(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid bill id")
		return
	}

	b, err := fetchBill(s.db, id)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "bill not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not read bill")
		return
	}

	writeJSON(w, http.StatusOK, b)
}

func (s *server) handleBillEscpos(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid bill id")
		return
	}

	b, err := fetchBill(s.db, id)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "bill not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not read bill")
		return
	}

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="bill-%d.bin"`, b.ID))
	w.Write(buildReceiptESCPOS(b))
}

func fetchBill(db *sql.DB, id int64) (Bill, error) {
	var b Bill
	err := db.QueryRow(
		`SELECT id, customer_name, payment_method, total_amount, created_at FROM bills WHERE id = $1`, id,
	).Scan(&b.ID, &b.CustomerName, &b.PaymentMethod, &b.TotalAmount, &b.CreatedAt)
	if err != nil {
		return Bill{}, err
	}

	rows, err := db.Query(
		`SELECT id, item_name, unit_price, quantity, line_total FROM bill_items WHERE bill_id = $1 ORDER BY id`, id,
	)
	if err != nil {
		return Bill{}, err
	}
	defer rows.Close()

	items := []BillItem{}
	for rows.Next() {
		var it BillItem
		if err := rows.Scan(&it.ID, &it.ItemName, &it.UnitPrice, &it.Quantity, &it.LineTotal); err != nil {
			return Bill{}, err
		}
		items = append(items, it)
	}
	b.Items = items

	return b, nil
}
