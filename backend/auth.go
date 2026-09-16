package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const sessionCookieName = "ni_session"
const sessionTTL = 30 * 24 * time.Hour
const minPasswordLength = 8

type ctxKey int

const userCtxKey ctxKey = 0

// generateSessionToken returns 32 random bytes, base64url-encoded — this is
// the raw value handed to the client. Only its hash is ever stored server-side.
func generateSessionToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// hashSessionToken hashes with plain SHA-256 rather than bcrypt: the token is
// already 256 bits of high-entropy randomness (not a human-guessable
// password), so bcrypt's deliberate slowness would just cost CPU on every
// authenticated request for no security benefit.
func hashSessionToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func userFromContext(ctx context.Context) User {
	u, _ := ctx.Value(userCtxKey).(User)
	return u
}

func (s *server) setSessionCookie(w http.ResponseWriter, token string, expiresAt time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   s.cookieSecure,
		SameSite: s.cookieSameSite,
		Expires:  expiresAt,
	})
}

func (s *server) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   s.cookieSecure,
		SameSite: s.cookieSameSite,
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
	})
}

// requireAuth guards routes behind a valid session cookie. It re-reads the
// user's current role from the DB on every request (rather than trusting a
// cached claim), so a role change or removal takes effect on the very next
// request — not just for future logins.
func (s *server) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(sessionCookieName)
		if err != nil || cookie.Value == "" {
			writeError(w, http.StatusUnauthorized, "not authenticated")
			return
		}

		hash := hashSessionToken(cookie.Value)
		var u User
		var expiresAt time.Time
		err = s.db.QueryRow(`
			SELECT u.id, u.username, u.role, u.created_at, s.expires_at
			FROM sessions s JOIN users u ON u.id = s.user_id
			WHERE s.token_hash = $1`, hash,
		).Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt, &expiresAt)
		if err == sql.ErrNoRows || (err == nil && expiresAt.Before(time.Now())) {
			writeError(w, http.StatusUnauthorized, "session expired or invalid")
			return
		} else if err != nil {
			writeError(w, http.StatusInternalServerError, "could not verify session")
			return
		}

		newExpiry := time.Now().Add(sessionTTL)
		_, _ = s.db.Exec(`UPDATE sessions SET last_seen_at = now(), expires_at = $1 WHERE token_hash = $2`, newExpiry, hash)

		next(w, r.WithContext(context.WithValue(r.Context(), userCtxKey, u)))
	}
}

// requireAdmin additionally requires the "admin" role, for account management routes.
func (s *server) requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return s.requireAuth(func(w http.ResponseWriter, r *http.Request) {
		if userFromContext(r.Context()).Role != "admin" {
			writeError(w, http.StatusForbidden, "admin role required")
			return
		}
		next(w, r)
	})
}

func (s *server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	var id int64
	var passwordHash string
	err := s.db.QueryRow(`SELECT id, password_hash FROM users WHERE username = $1`, req.Username).Scan(&id, &passwordHash)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusUnauthorized, "invalid username or password")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not log in")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)) != nil {
		writeError(w, http.StatusUnauthorized, "invalid username or password")
		return
	}

	token, err := generateSessionToken()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create session")
		return
	}
	expiresAt := time.Now().Add(sessionTTL)
	if _, err := s.db.Exec(
		`INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
		id, hashSessionToken(token), expiresAt,
	); err != nil {
		writeError(w, http.StatusInternalServerError, "could not create session")
		return
	}

	s.setSessionCookie(w, token, expiresAt)

	var u User
	if err := s.db.QueryRow(`SELECT id, username, role, created_at FROM users WHERE id = $1`, id).
		Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt); err != nil {
		writeError(w, http.StatusInternalServerError, "could not read account")
		return
	}
	writeJSON(w, http.StatusOK, u)
}

func (s *server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(sessionCookieName); err == nil && cookie.Value != "" {
		_, _ = s.db.Exec(`DELETE FROM sessions WHERE token_hash = $1`, hashSessionToken(cookie.Value))
	}
	s.clearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) handleMe(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, userFromContext(r.Context()))
}

func (s *server) handleChangePassword(w http.ResponseWriter, r *http.Request) {
	var req ChangePasswordRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	if len(req.NewPassword) < minPasswordLength {
		writeError(w, http.StatusBadRequest, "new password must be at least 8 characters")
		return
	}

	me := userFromContext(r.Context())

	var passwordHash string
	if err := s.db.QueryRow(`SELECT password_hash FROM users WHERE id = $1`, me.ID).Scan(&passwordHash); err != nil {
		writeError(w, http.StatusInternalServerError, "could not verify current password")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.CurrentPassword)) != nil {
		writeError(w, http.StatusUnauthorized, "current password is incorrect")
		return
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update password")
		return
	}
	if _, err := s.db.Exec(`UPDATE users SET password_hash = $1 WHERE id = $2`, newHash, me.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "could not update password")
		return
	}

	// Changing your password kills every other active session for this
	// account, but keeps the one making this request logged in.
	currentHash := ""
	if cookie, err := r.Cookie(sessionCookieName); err == nil {
		currentHash = hashSessionToken(cookie.Value)
	}
	_, _ = s.db.Exec(`DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2`, me.ID, currentHash)

	w.WriteHeader(http.StatusNoContent)
}

// withCORS allows credentialed (cookie-carrying) requests only from an
// explicit allow-list of admin origins, since a wildcard Allow-Origin can't
// be combined with Allow-Credentials. Any other origin still gets an open
// wildcard — that's unchanged behavior for the public storefront, which
// never sends credentials and doesn't need cookie access.
func withCORS(allowedOrigins map[string]bool, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if allowedOrigins[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Vary", "Origin")
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
