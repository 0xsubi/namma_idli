package main

import (
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

var validOrderStatuses = map[string]bool{
	"pending":   true,
	"accepted":  true,
	"ready":     true,
	"completed": true,
	"cancelled": true,
}

// handleCreateOrder is the public-facing endpoint the storefront calls when a
// customer places an order. Prices are always looked up server-side from the
// items catalog by name — the client never gets to supply a price.
func (s *server) handleCreateOrder(w http.ResponseWriter, r *http.Request) {
	var req CreateOrderRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	if len(req.Items) == 0 {
		writeError(w, http.StatusBadRequest, "order must have at least one item")
		return
	}
	if req.CustomerName == "" {
		writeError(w, http.StatusBadRequest, "customer_name is required")
		return
	}

	var total float64
	items := make([]OrderItem, 0, len(req.Items))
	for _, it := range req.Items {
		if it.Quantity <= 0 {
			writeError(w, http.StatusBadRequest, "quantity must be > 0 for "+it.ItemName)
			return
		}

		var price float64
		var status string
		err := s.db.QueryRow(`SELECT price, status FROM items WHERE LOWER(name) = LOWER($1)`, it.ItemName).Scan(&price, &status)
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusBadRequest, "unknown item: "+it.ItemName)
			return
		} else if err != nil {
			writeError(w, http.StatusInternalServerError, "could not look up item")
			return
		}
		if status != "available" {
			writeError(w, http.StatusBadRequest, it.ItemName+" is not available right now")
			return
		}

		lineTotal := price * float64(it.Quantity)
		total += lineTotal
		items = append(items, OrderItem{
			ItemName:  it.ItemName,
			UnitPrice: price,
			Quantity:  it.Quantity,
			LineTotal: lineTotal,
		})
	}

	tx, err := s.db.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not start transaction")
		return
	}
	defer tx.Rollback()

	var orderID int64
	err = tx.QueryRow(
		`INSERT INTO orders (customer_name, customer_phone, notes, status, total_amount) VALUES ($1, $2, $3, 'pending', $4) RETURNING id`,
		req.CustomerName, req.CustomerPhone, req.Notes, total,
	).Scan(&orderID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create order")
		return
	}

	stmt, err := tx.Prepare(`INSERT INTO order_items (order_id, item_name, unit_price, quantity, line_total) VALUES ($1, $2, $3, $4, $5) RETURNING id`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not save order items")
		return
	}
	defer stmt.Close()

	for i := range items {
		if err := stmt.QueryRow(orderID, items[i].ItemName, items[i].UnitPrice, items[i].Quantity, items[i].LineTotal).Scan(&items[i].ID); err != nil {
			writeError(w, http.StatusInternalServerError, "could not save order items")
			return
		}
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "could not commit order")
		return
	}

	order, err := fetchOrder(s.db, orderID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "order saved but could not be read back")
		return
	}

	go s.notifyNewOrder(order)

	writeJSON(w, http.StatusCreated, order)
}

func (s *server) handleListOrders(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")

	query := `SELECT id, customer_name, customer_phone, notes, status, total_amount, bill_id, created_at FROM orders`
	args := []any{}
	if status != "" {
		query += ` WHERE status = $1`
		args = append(args, status)
	}
	query += ` ORDER BY id DESC LIMIT 200`

	rows, err := s.db.Query(query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list orders")
		return
	}
	defer rows.Close()

	orders := []Order{}
	for rows.Next() {
		var o Order
		if err := rows.Scan(&o.ID, &o.CustomerName, &o.CustomerPhone, &o.Notes, &o.Status, &o.TotalAmount, &o.BillID, &o.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "could not read orders")
			return
		}
		orders = append(orders, o)
	}
	writeJSON(w, http.StatusOK, orders)
}

func (s *server) handleGetOrder(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid order id")
		return
	}

	order, err := fetchOrder(s.db, id)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "order not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not read order")
		return
	}

	writeJSON(w, http.StatusOK, order)
}

func (s *server) handleUpdateOrderStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid order id")
		return
	}

	var req UpdateOrderStatusRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	if !validOrderStatuses[req.Status] {
		writeError(w, http.StatusBadRequest, "status must be one of pending, accepted, ready, completed, cancelled")
		return
	}

	res, err := s.db.Exec(`UPDATE orders SET status = $1 WHERE id = $2`, req.Status, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update order")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "order not found")
		return
	}

	order, err := fetchOrder(s.db, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not read updated order")
		return
	}

	writeJSON(w, http.StatusOK, order)
}

// handleConvertOrderToBill turns a fulfilled order into a printable bill,
// preserving the item snapshot already captured on the order.
func (s *server) handleConvertOrderToBill(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid order id")
		return
	}

	var req ConvertOrderRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	order, err := fetchOrder(s.db, id)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "order not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not read order")
		return
	}
	if order.BillID != nil {
		writeError(w, http.StatusConflict, "order already converted to a bill")
		return
	}

	billItems := make([]BillItemInput, len(order.Items))
	for i, it := range order.Items {
		billItems[i] = BillItemInput{ItemName: it.ItemName, UnitPrice: it.UnitPrice, Quantity: it.Quantity}
	}

	bill, err := insertBill(s.db, order.CustomerName, req.PaymentMethod, billItems)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create bill")
		return
	}

	if _, err := s.db.Exec(`UPDATE orders SET status = 'completed', bill_id = $1 WHERE id = $2`, bill.ID, id); err != nil {
		writeError(w, http.StatusInternalServerError, "bill created but order could not be marked completed")
		return
	}

	writeJSON(w, http.StatusCreated, bill)
}

func fetchOrder(db *sql.DB, id int64) (Order, error) {
	var o Order
	err := db.QueryRow(
		`SELECT id, customer_name, customer_phone, notes, status, total_amount, bill_id, created_at FROM orders WHERE id = $1`, id,
	).Scan(&o.ID, &o.CustomerName, &o.CustomerPhone, &o.Notes, &o.Status, &o.TotalAmount, &o.BillID, &o.CreatedAt)
	if err != nil {
		return Order{}, err
	}

	rows, err := db.Query(
		`SELECT id, item_name, unit_price, quantity, line_total FROM order_items WHERE order_id = $1 ORDER BY id`, id,
	)
	if err != nil {
		return Order{}, err
	}
	defer rows.Close()

	items := []OrderItem{}
	for rows.Next() {
		var it OrderItem
		if err := rows.Scan(&it.ID, &it.ItemName, &it.UnitPrice, &it.Quantity, &it.LineTotal); err != nil {
			return Order{}, err
		}
		items = append(items, it)
	}
	o.Items = items

	return o, nil
}

func (s *server) notifyNewOrder(o Order) {
	names := make([]string, len(o.Items))
	for i, it := range o.Items {
		names[i] = fmt.Sprintf("%dx %s", it.Quantity, it.ItemName)
	}
	title := fmt.Sprintf("New order #%d — %s", o.ID, o.CustomerName)
	body := fmt.Sprintf("%s — Rs.%.2f", strings.Join(names, ", "), o.TotalAmount)

	s.sendPushToAll(title, body, o.ID)
	s.sendFCMToAll(title, body, o.ID)
}
