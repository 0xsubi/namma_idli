package main

import (
	"crypto/subtle"
	"net/http"
	"strings"
)

// requireAdminToken guards staff-only endpoints behind a shared token, sent
// either as `X-Admin-Token: <token>` or `Authorization: Bearer <token>`.
func (s *server) requireAdminToken(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := r.Header.Get("X-Admin-Token")
		if token == "" {
			if auth := r.Header.Get("Authorization"); strings.HasPrefix(auth, "Bearer ") {
				token = strings.TrimPrefix(auth, "Bearer ")
			}
		}

		if token == "" || subtle.ConstantTimeCompare([]byte(token), []byte(s.adminToken)) != 1 {
			writeError(w, http.StatusUnauthorized, "missing or invalid admin token")
			return
		}

		next(w, r)
	}
}

// withCORS lets the frontend call this API from a different origin — the
// storefront/admin panels invoke it as an absolute URL (localhost during
// local dev, the hosted domain otherwise) rather than a same-origin path.
// The admin token travels in a header rather than a cookie, so an open
// Allow-Origin doesn't expose anything the token check doesn't already gate.
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Admin-Token, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
