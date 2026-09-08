package main

import (
	"net/http"
	"time"
)

func dateRange(r *http.Request) (from, to string) {
	to = r.URL.Query().Get("to")
	from = r.URL.Query().Get("from")
	now := time.Now().UTC()
	if to == "" {
		to = now.Format("2006-01-02")
	}
	if from == "" {
		from = now.AddDate(0, 0, -30).Format("2006-01-02")
	}
	return from, to
}

func (s *server) handleAnalyticsSummary(w http.ResponseWriter, r *http.Request) {
	from, to := dateRange(r)

	summary := AnalyticsSummary{From: from, To: to}

	err := s.db.QueryRow(
		`SELECT COUNT(*), COALESCE(SUM(total_amount), 0) FROM bills WHERE created_at::date BETWEEN $1 AND $2`,
		from, to,
	).Scan(&summary.BillCount, &summary.BillRevenue)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not compute bill stats")
		return
	}

	err = s.db.QueryRow(
		`SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM sales WHERE sale_date BETWEEN $1 AND $2`,
		from, to,
	).Scan(&summary.ManualSalesCount, &summary.ManualSalesRevenue)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not compute sales stats")
		return
	}

	summary.TotalRevenue = summary.BillRevenue + summary.ManualSalesRevenue
	if summary.BillCount > 0 {
		summary.AverageBillValue = summary.BillRevenue / float64(summary.BillCount)
	}

	rows, err := s.db.Query(
		`SELECT bi.item_name, SUM(bi.quantity), SUM(bi.line_total)
		 FROM bill_items bi
		 JOIN bills b ON b.id = bi.bill_id
		 WHERE b.created_at::date BETWEEN $1 AND $2
		 GROUP BY bi.item_name
		 ORDER BY SUM(bi.line_total) DESC
		 LIMIT 5`,
		from, to,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not compute top items")
		return
	}
	defer rows.Close()

	topItems := []TopItem{}
	for rows.Next() {
		var t TopItem
		if err := rows.Scan(&t.ItemName, &t.Quantity, &t.Revenue); err != nil {
			writeError(w, http.StatusInternalServerError, "could not read top items")
			return
		}
		topItems = append(topItems, t)
	}
	summary.TopItems = topItems

	writeJSON(w, http.StatusOK, summary)
}
