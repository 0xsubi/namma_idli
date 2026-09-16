package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"

	"golang.org/x/crypto/bcrypt"
)

var validRoles = map[string]bool{"member": true, "admin": true}

// bootstrapAdmin seeds the very first account from BOOTSTRAP_ADMIN_USERNAME /
// BOOTSTRAP_ADMIN_PASSWORD, but only while the users table is empty — once
// any account exists (even a different one), this is permanently a no-op, so
// it's safe to leave the env vars set after the first successful boot.
func bootstrapAdmin(db *sql.DB) error {
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&count); err != nil {
		return fmt.Errorf("count users: %w", err)
	}
	if count > 0 {
		return nil
	}

	username := os.Getenv("BOOTSTRAP_ADMIN_USERNAME")
	password := os.Getenv("BOOTSTRAP_ADMIN_PASSWORD")
	if username == "" || password == "" {
		log.Println("no admin accounts exist and BOOTSTRAP_ADMIN_USERNAME/BOOTSTRAP_ADMIN_PASSWORD are not set — set them and restart to create the first account")
		return nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash bootstrap password: %w", err)
	}
	if _, err := db.Exec(`INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'admin')`, username, hash); err != nil {
		return fmt.Errorf("insert bootstrap admin: %w", err)
	}
	log.Printf("created bootstrap admin account %q — remove BOOTSTRAP_ADMIN_USERNAME/BOOTSTRAP_ADMIN_PASSWORD from the environment now", username)
	return nil
}

func (s *server) handleListUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(`SELECT id, username, role, created_at FROM users ORDER BY username`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list users")
		return
	}
	defer rows.Close()

	users := []User{}
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "could not read users")
			return
		}
		users = append(users, u)
	}
	writeJSON(w, http.StatusOK, users)
}

func (s *server) handleCreateUser(w http.ResponseWriter, r *http.Request) {
	var req CreateUserRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	if req.Username == "" || len(req.Password) < minPasswordLength {
		writeError(w, http.StatusBadRequest, "username is required and password must be at least 8 characters")
		return
	}
	if req.Role == "" {
		req.Role = "member"
	}
	if !validRoles[req.Role] {
		writeError(w, http.StatusBadRequest, "role must be either member or admin")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create user")
		return
	}

	var id int64
	err = s.db.QueryRow(
		`INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id`,
		req.Username, hash, req.Role,
	).Scan(&id)
	if isUniqueConstraintErr(err) {
		writeError(w, http.StatusConflict, "a user with this username already exists")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create user")
		return
	}

	var u User
	if err := s.db.QueryRow(`SELECT id, username, role, created_at FROM users WHERE id = $1`, id).
		Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt); err != nil {
		writeError(w, http.StatusInternalServerError, "could not read created user")
		return
	}
	writeJSON(w, http.StatusCreated, u)
}

func (s *server) handleUpdateUserRole(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	var req UpdateUserRoleRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	if !validRoles[req.Role] {
		writeError(w, http.StatusBadRequest, "role must be either member or admin")
		return
	}

	if err := s.updateUserRoleGuarded(r.Context(), id, req.Role); err != nil {
		if errors.Is(err, errLastAdmin) {
			writeError(w, http.StatusConflict, "cannot demote the last remaining admin")
			return
		}
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "user not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "could not update user")
		return
	}

	var u User
	if err := s.db.QueryRow(`SELECT id, username, role, created_at FROM users WHERE id = $1`, id).
		Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt); err != nil {
		writeError(w, http.StatusInternalServerError, "could not read updated user")
		return
	}
	writeJSON(w, http.StatusOK, u)
}

func (s *server) handleDeleteUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	if err := s.deleteUserGuarded(r.Context(), id); err != nil {
		if errors.Is(err, errLastAdmin) {
			writeError(w, http.StatusConflict, "cannot remove the last remaining admin")
			return
		}
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "user not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "could not remove user")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

var errLastAdmin = errors.New("cannot remove or demote the last remaining admin")

// updateUserRoleGuarded and deleteUserGuarded both lock the target row before
// counting remaining admins, so two concurrent requests can't both "pass" the
// last-admin check and leave the account with zero admins.

func (s *server) updateUserRoleGuarded(ctx context.Context, targetID int64, newRole string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var currentRole string
	if err := tx.QueryRowContext(ctx, `SELECT role FROM users WHERE id = $1 FOR UPDATE`, targetID).Scan(&currentRole); err != nil {
		return err
	}
	if currentRole == "admin" && newRole != "admin" {
		if err := ensureOtherAdminExists(ctx, tx, targetID); err != nil {
			return err
		}
	}

	if _, err := tx.ExecContext(ctx, `UPDATE users SET role = $1 WHERE id = $2`, newRole, targetID); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *server) deleteUserGuarded(ctx context.Context, targetID int64) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var currentRole string
	if err := tx.QueryRowContext(ctx, `SELECT role FROM users WHERE id = $1 FOR UPDATE`, targetID).Scan(&currentRole); err != nil {
		return err
	}
	if currentRole == "admin" {
		if err := ensureOtherAdminExists(ctx, tx, targetID); err != nil {
			return err
		}
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, targetID); err != nil {
		return err
	}
	return tx.Commit()
}

func ensureOtherAdminExists(ctx context.Context, tx *sql.Tx, excludingID int64) error {
	var otherAdmins int
	if err := tx.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM users WHERE role = 'admin' AND id <> $1`, excludingID,
	).Scan(&otherAdmins); err != nil {
		return err
	}
	if otherAdmins == 0 {
		return errLastAdmin
	}
	return nil
}
