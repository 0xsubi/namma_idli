package main

import (
	"encoding/json"
	"log"
	"net/http"

	webpush "github.com/SherClockHolmes/webpush-go"
)

func (s *server) handleVapidPublicKey(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"public_key": s.vapidPublicKey})
}

func (s *server) handleSubscribe(w http.ResponseWriter, r *http.Request) {
	var req PushSubscriptionRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	if req.Endpoint == "" || req.Keys.P256dh == "" || req.Keys.Auth == "" {
		writeError(w, http.StatusBadRequest, "endpoint and keys are required")
		return
	}

	_, err := s.db.Exec(
		`INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES ($1, $2, $3)
		 ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`,
		req.Endpoint, req.Keys.P256dh, req.Keys.Auth,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not save subscription")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *server) handleUnsubscribe(w http.ResponseWriter, r *http.Request) {
	var req UnsubscribeRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	if _, err := s.db.Exec(`DELETE FROM push_subscriptions WHERE endpoint = $1`, req.Endpoint); err != nil {
		writeError(w, http.StatusInternalServerError, "could not remove subscription")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type pushPayload struct {
	Title   string `json:"title"`
	Body    string `json:"body"`
	OrderID int64  `json:"order_id"`
}

// sendPushToAll pushes a notification to every registered device. Called
// from a goroutine so it never slows down the HTTP response that triggered
// it. Subscriptions the push service reports as gone (410) are pruned.
func (s *server) sendPushToAll(title, body string, orderID int64) {
	if s.vapidPrivateKey == "" || s.vapidPublicKey == "" {
		log.Printf("push: VAPID keys not configured, skipping notification for order %d", orderID)
		return
	}

	rows, err := s.db.Query(`SELECT id, endpoint, p256dh, auth FROM push_subscriptions`)
	if err != nil {
		log.Printf("push: could not load subscriptions: %v", err)
		return
	}
	type sub struct {
		id                 int64
		endpoint, p256, au string
	}
	var subs []sub
	for rows.Next() {
		var sc sub
		if err := rows.Scan(&sc.id, &sc.endpoint, &sc.p256, &sc.au); err != nil {
			continue
		}
		subs = append(subs, sc)
	}
	rows.Close()

	payload, err := json.Marshal(pushPayload{Title: title, Body: body, OrderID: orderID})
	if err != nil {
		log.Printf("push: could not encode payload: %v", err)
		return
	}

	for _, sc := range subs {
		resp, err := webpush.SendNotification(payload, &webpush.Subscription{
			Endpoint: sc.endpoint,
			Keys:     webpush.Keys{P256dh: sc.p256, Auth: sc.au},
		}, &webpush.Options{
			Subscriber:      s.vapidSubject,
			VAPIDPublicKey:  s.vapidPublicKey,
			VAPIDPrivateKey: s.vapidPrivateKey,
			TTL:             30,
		})
		if err != nil {
			log.Printf("push: send failed for subscription %d: %v", sc.id, err)
			continue
		}
		resp.Body.Close()

		if resp.StatusCode == http.StatusGone || resp.StatusCode == http.StatusNotFound {
			s.db.Exec(`DELETE FROM push_subscriptions WHERE id = $1`, sc.id)
		}
	}
}
