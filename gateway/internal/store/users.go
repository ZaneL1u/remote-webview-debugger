package store

import (
	"context"
	"database/sql"
	"errors"
	"slices"
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
	ID          string `json:"id"`
	Email       string `json:"email"`
	Name        string `json:"name"`
	Role        string `json:"role"`
	Disabled    bool   `json:"disabled"`
	Pending     bool   `json:"pending"`
	CreatedAt   int64  `json:"createdAt"`
	LastLoginAt *int64 `json:"lastLoginAt"`
	// HasPassword: the account can sign in with a password (accounts created
	// by single sign-on have none).
	HasPassword bool `json:"hasPassword"`
	// SSO lists the single sign-on providers linked to the account ("feishu",
	// "lark", "oidc"); filled by AttachSSO.
	SSO          []string `json:"sso"`
	PasswordHash string   `json:"-"`
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
	u.HasPassword = u.PasswordHash != ""
	u.SSO = []string{}
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
		PasswordHash: passwordHash, Pending: passwordHash == "" && inviteHash != "", HasPassword: passwordHash != "", SSO: []string{}}
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
	if _, err := s.exec(ctx, `DELETE FROM user_identities WHERE user_id = ?`, id); err != nil {
		return err
	}
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

// --- single sign-on identities ---

// UserByIdentity returns the account linked to subject at provider.
func (s *Store) UserByIdentity(ctx context.Context, provider, subject string) (*User, error) {
	return scanUser(s.row(ctx, `SELECT `+prefixed("u.", userCols)+` FROM users u JOIN user_identities i ON i.user_id = u.id
		WHERE i.provider = ? AND i.subject = ?`, provider, subject))
}

// LinkIdentity links subject at provider to the account, and drops a pending
// invite: signing in through the provider accepts it.
func (s *Store) LinkIdentity(ctx context.Context, userID, provider, subject string) error {
	_, err := s.exec(ctx, `INSERT INTO user_identities (provider, subject, user_id, created_at) VALUES (?, ?, ?, ?)`,
		provider, subject, userID, now())
	if isUnique(err) {
		return ErrConflict
	}
	if err != nil {
		return err
	}
	_, err = s.exec(ctx, `UPDATE users SET invite_hash = '', invite_expires = NULL WHERE id = ?`, userID)
	return err
}

// ResetInvite gives an account without a password a new invite link, and
// the previous one stops working: a lost invite, or a single sign-on account
// that needs a password. ErrConflict: the account has a password.
func (s *Store) ResetInvite(ctx context.Context, id, inviteHash string, inviteExpires int64) error {
	res, err := s.exec(ctx, `UPDATE users SET invite_hash = ?, invite_expires = ? WHERE id = ? AND password_hash = ''`,
		inviteHash, inviteExpires, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		if _, err := s.User(ctx, id); err != nil {
			return err
		}
		return ErrConflict
	}
	return nil
}

// HasIdentity reports whether the account is linked to an identity of provider.
func (s *Store) HasIdentity(ctx context.Context, userID, provider string) (bool, error) {
	var n int
	err := s.row(ctx, `SELECT COUNT(*) FROM user_identities WHERE user_id = ? AND provider = ?`, userID, provider).Scan(&n)
	return n > 0, err
}

// SetEmail changes the account's email (its sign-in name).
func (s *Store) SetEmail(ctx context.Context, id, email string) error {
	_, err := s.exec(ctx, `UPDATE users SET email = ? WHERE id = ?`, normEmail(email), id)
	if isUnique(err) {
		return ErrConflict
	}
	return err
}

// AttachSSO fills User.SSO with the provider kinds linked to each account
// (the part of the provider key before ":", so "oidc:https://idp" is "oidc").
func (s *Store) AttachSSO(ctx context.Context, users ...*User) error {
	byID := map[string]*User{}
	for _, u := range users {
		u.SSO = []string{}
		byID[u.ID] = u
	}
	q, args := `SELECT user_id, provider FROM user_identities ORDER BY created_at`, []any{}
	if len(users) == 1 {
		q, args = `SELECT user_id, provider FROM user_identities WHERE user_id = ? ORDER BY created_at`, []any{users[0].ID}
	}
	rows, err := s.query(ctx, q, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var uid, provider string
		if err := rows.Scan(&uid, &provider); err != nil {
			return err
		}
		kind, _, _ := strings.Cut(provider, ":")
		if u := byID[uid]; u != nil && !slices.Contains(u.SSO, kind) {
			u.SSO = append(u.SSO, kind)
			u.Pending = false // signs in already; an open invite only sets a password
		}
	}
	return rows.Err()
}

func prefixed(p, cols string) string {
	parts := strings.Split(cols, ", ")
	for i := range parts {
		parts[i] = p + parts[i]
	}
	return strings.Join(parts, ", ")
}
