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
