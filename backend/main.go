package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
	_ "github.com/jackc/pgx/v5/stdlib"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type server struct {
	db              *sql.DB
	vapidPublicKey  string
	vapidPrivateKey string
	vapidSubject    string
	cookieSecure    bool
	cookieSameSite  http.SameSite
	fcmProjectID    string
	fcmTokenSource  oauth2.TokenSource
	uploadsDir      string
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
	if err := bootstrapAdmin(db); err != nil {
		log.Fatalf("bootstrap admin: %v", err)
	}

	vapidSubject := os.Getenv("VAPID_SUBJECT")
	if vapidSubject == "" {
		vapidSubject = "mailto:admin@example.com"
	}

	adminOrigins := map[string]bool{}
	for _, origin := range strings.Split(os.Getenv("ADMIN_ORIGINS"), ",") {
		if origin = strings.TrimSpace(origin); origin != "" {
			adminOrigins[origin] = true
		}
	}
	if len(adminOrigins) == 0 {
		adminOrigins = map[string]bool{"http://localhost:5174": true, "https://localhost": true}
		log.Println("ADMIN_ORIGINS not set — defaulting to http://localhost:5174,https://localhost (local dev + Capacitor Android). Set ADMIN_ORIGINS to your deployed admin origin(s) in production.")
	}

	cookieSecure := os.Getenv("COOKIE_SECURE") != "false"
	cookieSameSite := http.SameSiteNoneMode
	if os.Getenv("COOKIE_SAMESITE") == "lax" {
		cookieSameSite = http.SameSiteLaxMode
	}

	uploadsDir := os.Getenv("UPLOADS_DIR")
	if uploadsDir == "" {
		uploadsDir = "./uploads"
	}
	if err := os.MkdirAll(uploadsDir, 0o755); err != nil {
		log.Fatalf("create uploads dir: %v", err)
	}

	s := &server{
		db:              db,
		vapidPublicKey:  os.Getenv("VAPID_PUBLIC_KEY"),
		vapidPrivateKey: os.Getenv("VAPID_PRIVATE_KEY"),
		vapidSubject:    vapidSubject,
		cookieSecure:    cookieSecure,
		cookieSameSite:  cookieSameSite,
		uploadsDir:      uploadsDir,
	}
	if s.vapidPublicKey == "" || s.vapidPrivateKey == "" {
		log.Println("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — order push notifications are disabled. Run `go run . genvapid` to generate a keypair.")
	}

	if err := s.loadFCMCredentials(); err != nil {
		log.Fatalf("load FCM credentials: %v", err)
	}
	if s.fcmProjectID == "" {
		log.Println("FCM_SERVICE_ACCOUNT_FILE / FCM_SERVICE_ACCOUNT_JSON not set — native Android push notifications are disabled.")
	}

	mux := http.NewServeMux()
	authed := s.requireAuth
	adminOnly := s.requireAdmin

	mux.HandleFunc("GET /api/health", s.handleHealth)

	mux.HandleFunc("POST /api/auth/login", s.handleLogin)
	mux.HandleFunc("POST /api/auth/logout", s.handleLogout)
	mux.HandleFunc("GET /api/auth/me", authed(s.handleMe))
	mux.HandleFunc("POST /api/auth/change-password", authed(s.handleChangePassword))

	mux.HandleFunc("GET /api/users", adminOnly(s.handleListUsers))
	mux.HandleFunc("POST /api/users", adminOnly(s.handleCreateUser))
	mux.HandleFunc("PATCH /api/users/{id}", adminOnly(s.handleUpdateUserRole))
	mux.HandleFunc("DELETE /api/users/{id}", adminOnly(s.handleDeleteUser))

	mux.HandleFunc("POST /api/items", authed(s.handleCreateItem))
	mux.HandleFunc("GET /api/items", authed(s.handleListItems))
	mux.HandleFunc("PUT /api/items/{id}", authed(s.handleUpdateItem))
	mux.HandleFunc("DELETE /api/items/{id}", authed(s.handleDeleteItem))
	mux.HandleFunc("POST /api/items/{id}/image", authed(s.handleUploadItemImage))

	// The storefront's menu is public — no login needed to browse it.
	mux.HandleFunc("GET /api/menu", s.handleListItems)
	mux.Handle("GET /uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(s.uploadsDir))))

	mux.HandleFunc("POST /api/bills", authed(s.handleCreateBill))
	mux.HandleFunc("GET /api/bills", authed(s.handleListBills))
	mux.HandleFunc("GET /api/bills/{id}", authed(s.handleGetBill))
	mux.HandleFunc("GET /api/bills/{id}/escpos", authed(s.handleBillEscpos))

	mux.HandleFunc("POST /api/sales", authed(s.handleCreateSale))
	mux.HandleFunc("GET /api/sales", authed(s.handleListSales))

	mux.HandleFunc("GET /api/analytics/summary", authed(s.handleAnalyticsSummary))

	mux.HandleFunc("POST /api/voice/parse", authed(s.handleVoiceParse))

	// Order creation is public — it's what the storefront calls when a
	// customer places an order. Everything else about orders is staff-only.
	mux.HandleFunc("POST /api/orders", s.handleCreateOrder)
	mux.HandleFunc("GET /api/orders", authed(s.handleListOrders))
	mux.HandleFunc("GET /api/orders/{id}", authed(s.handleGetOrder))
	mux.HandleFunc("PATCH /api/orders/{id}", authed(s.handleUpdateOrderStatus))
	mux.HandleFunc("POST /api/orders/{id}/bill", authed(s.handleConvertOrderToBill))

	mux.HandleFunc("GET /api/push/vapid-public-key", authed(s.handleVapidPublicKey))
	mux.HandleFunc("POST /api/push/subscribe", authed(s.handleSubscribe))
	mux.HandleFunc("POST /api/push/unsubscribe", authed(s.handleUnsubscribe))
	mux.HandleFunc("POST /api/push/fcm/register", authed(s.handleRegisterFcmToken))
	mux.HandleFunc("POST /api/push/fcm/unregister", authed(s.handleUnregisterFcmToken))

	addr := ":8080"
	log.Printf("listening on %s", addr)
	if err := http.ListenAndServe(addr, withCORS(adminOrigins, mux)); err != nil {
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

// loadFCMCredentials reads a Firebase service account key from either
// FCM_SERVICE_ACCOUNT_FILE (a mounted JSON file, preferred under Docker) or
// FCM_SERVICE_ACCOUNT_JSON (the raw JSON inline). Leaving both unset just
// disables native push — it isn't a fatal error.
func (s *server) loadFCMCredentials() error {
	var creds []byte
	if path := os.Getenv("FCM_SERVICE_ACCOUNT_FILE"); path != "" {
		b, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read FCM_SERVICE_ACCOUNT_FILE: %w", err)
		}
		creds = b
	} else if raw := os.Getenv("FCM_SERVICE_ACCOUNT_JSON"); raw != "" {
		creds = []byte(raw)
	} else {
		return nil
	}

	var sa struct {
		ProjectID string `json:"project_id"`
	}
	if err := json.Unmarshal(creds, &sa); err != nil {
		return fmt.Errorf("parse FCM service account JSON: %w", err)
	}
	if sa.ProjectID == "" {
		return fmt.Errorf("FCM service account JSON is missing project_id")
	}

	cfg, err := google.JWTConfigFromJSON(creds, "https://www.googleapis.com/auth/firebase.messaging")
	if err != nil {
		return fmt.Errorf("parse FCM service account JSON: %w", err)
	}

	s.fcmProjectID = sa.ProjectID
	s.fcmTokenSource = cfg.TokenSource(context.Background())
	return nil
}
