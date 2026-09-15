package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
	_ "github.com/jackc/pgx/v5/stdlib"
)

type server struct {
	db              *sql.DB
	vapidPublicKey  string
	vapidPrivateKey string
	vapidSubject    string
	adminToken      string
}

func main() {
	if len(os.Args) > 1 && os.Args[1] == "genvapid" {
		priv, pub, err := webpush.GenerateVAPIDKeys()
		if err != nil {
			log.Fatalf("generate vapid keys: %v", err)
		}
		fmt.Println("VAPID_PUBLIC_KEY=" + pub)
		fmt.Println("VAPID_PRIVATE_KEY=" + priv)
		return
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgres://postgres:postgres@localhost:5432/namma_idli?sslmode=disable"
	}

	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	if err := waitForDB(db, 30*time.Second); err != nil {
		log.Fatalf("connect to db: %v", err)
	}

	if err := migrate(db); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	vapidSubject := os.Getenv("VAPID_SUBJECT")
	if vapidSubject == "" {
		vapidSubject = "mailto:admin@example.com"
	}

	adminToken := os.Getenv("ADMIN_TOKEN")
	if adminToken == "" {
		adminToken = "hunter2"
		log.Println("ADMIN_TOKEN not set — defaulting to the placeholder token. Set ADMIN_TOKEN before deploying anywhere reachable from outside your machine.")
	}

	s := &server{
		db:              db,
		vapidPublicKey:  os.Getenv("VAPID_PUBLIC_KEY"),
		vapidPrivateKey: os.Getenv("VAPID_PRIVATE_KEY"),
		vapidSubject:    vapidSubject,
		adminToken:      adminToken,
	}
	if s.vapidPublicKey == "" || s.vapidPrivateKey == "" {
		log.Println("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — order push notifications are disabled. Run `go run . genvapid` to generate a keypair.")
	}

	mux := http.NewServeMux()
	admin := s.requireAdminToken

	mux.HandleFunc("GET /api/health", s.handleHealth)

	mux.HandleFunc("POST /api/items", admin(s.handleCreateItem))
	mux.HandleFunc("GET /api/items", admin(s.handleListItems))
	mux.HandleFunc("PUT /api/items/{id}", admin(s.handleUpdateItem))
	mux.HandleFunc("DELETE /api/items/{id}", admin(s.handleDeleteItem))

	mux.HandleFunc("POST /api/bills", admin(s.handleCreateBill))
	mux.HandleFunc("GET /api/bills", admin(s.handleListBills))
	mux.HandleFunc("GET /api/bills/{id}", admin(s.handleGetBill))
	mux.HandleFunc("GET /api/bills/{id}/escpos", admin(s.handleBillEscpos))

	mux.HandleFunc("POST /api/sales", admin(s.handleCreateSale))
	mux.HandleFunc("GET /api/sales", admin(s.handleListSales))

	mux.HandleFunc("GET /api/analytics/summary", admin(s.handleAnalyticsSummary))

	// Order creation is public — it's what the storefront calls when a
	// customer places an order. Everything else about orders is staff-only.
	mux.HandleFunc("POST /api/orders", s.handleCreateOrder)
	mux.HandleFunc("GET /api/orders", admin(s.handleListOrders))
	mux.HandleFunc("GET /api/orders/{id}", admin(s.handleGetOrder))
	mux.HandleFunc("PATCH /api/orders/{id}", admin(s.handleUpdateOrderStatus))
	mux.HandleFunc("POST /api/orders/{id}/bill", admin(s.handleConvertOrderToBill))

	mux.HandleFunc("GET /api/push/vapid-public-key", admin(s.handleVapidPublicKey))
	mux.HandleFunc("POST /api/push/subscribe", admin(s.handleSubscribe))
	mux.HandleFunc("POST /api/push/unsubscribe", admin(s.handleUnsubscribe))

	addr := ":8080"
	log.Printf("listening on %s", addr)
	if err := http.ListenAndServe(addr, withCORS(mux)); err != nil {
		log.Fatal(err)
	}
}

// waitForDB retries the initial ping since, under docker-compose, the
// Postgres container can still be starting up when this process launches.
func waitForDB(db *sql.DB, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	var err error
	for time.Now().Before(deadline) {
		if err = db.Ping(); err == nil {
			return nil
		}
		time.Sleep(1 * time.Second)
	}
	return err
}

func (s *server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
