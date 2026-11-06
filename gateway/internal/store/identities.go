package store

import "context"

// Identity is a member linked to a subject at a provider.
type Identity struct{ UserID, Subject string }

// Identities lists the members linked at provider (for the check of who has
// left the organization: server/sso_sync.go).
func (s *Store) Identities(ctx context.Context, provider string) ([]Identity, error) {
	rows, err := s.query(ctx, `SELECT user_id, subject FROM user_identities WHERE provider = ?`, provider)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Identity{}
	for rows.Next() {
		var i Identity
		if err := rows.Scan(&i.UserID, &i.Subject); err != nil {
			return nil, err
		}
		out = append(out, i)
	}
	return out, rows.Err()
}
