package store

import (
	"context"
	"database/sql"
)

// Identity is a member linked to a subject at a provider, with what the
// check that the provider still vouches for them keeps (server/key_check.go):
// the sealed refresh token, when the provider last confirmed them, and when
// it refused to (the token is dropped then; the next sign-in stores a new
// one and clears it).
type Identity struct {
	UserID, Subject string
	RefreshToken    string // sealed by the server; "" when none
	VerifiedAt      int64  // ms; 0: never
	RevokedAt       int64  // ms; 0: not refused
}

const identityCols = `user_id, subject, refresh_token, COALESCE(verified_at, 0), COALESCE(revoked_at, 0)`

func scanIdentities(rows *sql.Rows, err error) ([]Identity, error) {
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Identity{}
	for rows.Next() {
		var i Identity
		if err := rows.Scan(&i.UserID, &i.Subject, &i.RefreshToken, &i.VerifiedAt, &i.RevokedAt); err != nil {
			return nil, err
		}
		out = append(out, i)
	}
	return out, rows.Err()
}

// Identities lists the members linked at provider.
func (s *Store) Identities(ctx context.Context, provider string) ([]Identity, error) {
	return scanIdentities(s.query(ctx, `SELECT `+identityCols+` FROM user_identities WHERE provider = ? ORDER BY created_at`, provider))
}

// UserIdentities lists the account's identities at provider.
func (s *Store) UserIdentities(ctx context.Context, userID, provider string) ([]Identity, error) {
	return scanIdentities(s.query(ctx, `SELECT `+identityCols+` FROM user_identities WHERE user_id = ? AND provider = ? ORDER BY created_at`, userID, provider))
}

// Identity is one identity at provider.
func (s *Store) Identity(ctx context.Context, provider, subject string) (*Identity, error) {
	out, err := scanIdentities(s.query(ctx, `SELECT `+identityCols+` FROM user_identities WHERE provider = ? AND subject = ?`, provider, subject))
	if err != nil {
		return nil, err
	}
	if len(out) == 0 {
		return nil, ErrNotFound
	}
	return &out[0], nil
}

// SetIdentityToken stores the identity's (sealed) refresh token, "" for
// none, after the provider confirmed them: at a sign-in or a refresh. It
// clears a refusal.
func (s *Store) SetIdentityToken(ctx context.Context, provider, subject, sealed string) error {
	_, err := s.exec(ctx, `UPDATE user_identities SET refresh_token = ?, verified_at = ?, revoked_at = NULL
		WHERE provider = ? AND subject = ?`, sealed, now(), provider, subject)
	return err
}

// RevokeIdentity records that the provider refused the identity's refresh
// token, and drops it. revoked reports whether this call did (not already
// refused).
func (s *Store) RevokeIdentity(ctx context.Context, provider, subject string) (revoked bool, err error) {
	res, err := s.exec(ctx, `UPDATE user_identities SET refresh_token = '', revoked_at = ?
		WHERE provider = ? AND subject = ? AND revoked_at IS NULL`, now(), provider, subject)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n > 0, err
}
