package store

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/ZaneL1u/remote-webview-debugger/gateway/internal/ids"
)

// Roles, most privileged first.
const (
	RoleOwner  = "owner"
	RoleAdmin  = "admin"
	RoleMember = "member"
)

func RoleRank(r string) int {
	switch r {
	case RoleOwner:
		return 3
	case RoleAdmin:
		return 2
	case RoleMember:
		return 1
	}
	return 0
}

type User struct {
	ID           string `json:"id"`
	Email        string `json:"email"`
	Name         string `json:"name"`
	Role         string `json:"role"`
	Disabled     bool   `json:"disabled"`
	Pending      bool   `json:"pending"`
	CreatedAt    int64  `json:"createdAt"`
	LastLoginAt  *int64 `json:"lastLoginAt"`
	PasswordHash string `json:"-"`
}

const userCols = `id, email, name, password_hash, role, disabled, invite_hash, created_at, last_login_at`

func scanUser(row interface{ Scan(...any) error }) (*User, error) {
	var u User
	var disabled int
	var invite string
	var last sql.NullInt64
	if err := row.Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.Role, &disabled, &invite, &u.CreatedAt, &last); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	u.Disabled = disabled != 0
	u.Pending = u.PasswordHash == "" && invite != ""
	if last.Valid {
		u.LastLoginAt = &last.Int64
	}
	return &u, nil
}

func normEmail(e string) string { return strings.ToLower(strings.TrimSpace(e)) }

// NormEmail is how emails are stored and compared: trimmed, lower case.
func NormEmail(e string) string { return normEmail(e) }

func (s *Store) Users(ctx context.Context) ([]*User, error) {
	rows, err := s.query(ctx, `SELECT `+userCols+` FROM users ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*User{}
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (s *Store) UserCount(ctx context.Context) (int, error) {
	var n int
	err := s.row(ctx, `SELECT COUNT(*) FROM users`).Scan(&n)
	return n, err
}

func (s *Store) User(ctx context.Context, id string) (*User, error) {
	return scanUser(s.row(ctx, `SELECT `+userCols+` FROM users WHERE id = ?`, id))
}

func (s *Store) UserByEmail(ctx context.Context, email string) (*User, error) {
	return scanUser(s.row(ctx, `SELECT `+userCols+` FROM users WHERE email = ?`, normEmail(email)))
}

// CreateUser adds a user with a password (bootstrap) or an invite (inviteHash
// set, password empty).
func (s *Store) CreateUser(ctx context.Context, email, name, role, passwordHash, inviteHash string, inviteExpires *int64) (*User, error) {
	u := &User{ID: ids.ID(), Email: normEmail(email), Name: strings.TrimSpace(name), Role: role, CreatedAt: now(),
		PasswordHash: passwordHash, Pending: passwordHash == ""}
	_, err := s.exec(ctx, `INSERT INTO users (id, email, name, password_hash, role, disabled, invite_hash, invite_expires, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
		u.ID, u.Email, u.Name, passwordHash, role, inviteHash, inviteExpires, u.CreatedAt)
	if isUnique(err) {
		return nil, ErrConflict
	}
	return u, err
}

type UserPatch struct {
	Name     *string `json:"name"`
	Role     *string `json:"role"`
	Disabled *bool   `json:"disabled"`
}

func (s *Store) UpdateUser(ctx context.Context, id string, p UserPatch) (*User, error) {
	u, err := s.User(ctx, id)
	if err != nil {
		return nil, err
	}
	if p.Name != nil {
		u.Name = strings.TrimSpace(*p.Name)
	}
	if p.Role != nil {
		u.Role = *p.Role
	}
	if p.Disabled != nil {
		u.Disabled = *p.Disabled
	}
	disabled := 0
	if u.Disabled {
		disabled = 1
	}
	_, err = s.exec(ctx, `UPDATE users SET name = ?, role = ?, disabled = ? WHERE id = ?`, u.Name, u.Role, disabled, id)
	return u, err
}

func (s *Store) DeleteUser(ctx context.Context, id string) error {
	res, err := s.exec(ctx, `DELETE FROM users WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) SetPassword(ctx context.Context, id, hash string) error {
	_, err := s.exec(ctx, `UPDATE users SET password_hash = ?, invite_hash = '', invite_expires = NULL WHERE id = ?`, hash, id)
	return err
}

func (s *Store) TouchLogin(ctx context.Context, id string) {
	_, _ = s.exec(ctx, `UPDATE users SET last_login_at = ? WHERE id = ?`, now(), id)
}

// UserByInvite returns a pending user whose invite is still valid.
func (s *Store) UserByInvite(ctx context.Context, inviteHash string) (*User, error) {
	var expires sql.NullInt64
	u, err := scanUser(s.row(ctx, `SELECT `+userCols+` FROM users WHERE invite_hash = ? AND invite_hash <> ''`, inviteHash))
	if err != nil {
		return nil, err
	}
	if err := s.row(ctx, `SELECT invite_expires FROM users WHERE id = ?`, u.ID).Scan(&expires); err != nil {
		return nil, err
	}
	if expires.Valid && now() > expires.Int64 {
		return nil, ErrNotFound
	}
	return u, nil
}
