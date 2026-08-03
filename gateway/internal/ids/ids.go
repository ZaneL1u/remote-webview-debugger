// Package ids generates the random identifiers and secrets used by the
// gateway: project ids, app keys, API keys and device codes.
package ids

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"strings"
)

const base62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

// Device codes avoid characters people confuse when reading them aloud
// (0/O, 1/I/L).
const codeAlphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

func random(alphabet string, n int) string {
	// Rejection sampling keeps the distribution uniform.
	limit := byte(256 - 256%len(alphabet))
	out := make([]byte, 0, n)
	buf := make([]byte, n*2)
	for len(out) < n {
		if _, err := rand.Read(buf); err != nil {
			panic(err)
		}
		for _, b := range buf {
			if b < limit {
				out = append(out, alphabet[int(b)%len(alphabet)])
				if len(out) == n {
					break
				}
			}
		}
	}
	return string(out)
}

// ID returns a short random identifier for database rows.
func ID() string { return random(base62, 16) }

// AppKey returns a new public app key for a project.
func AppKey() string { return "rwd_pk_" + random(base62, 24) }

// APIKey returns a new secret API key.
func APIKey() string { return "rwd_sk_live_" + random(base62, 32) }

// DeviceCode returns a code like K7Q2-9M4X.
func DeviceCode() string {
	c := random(codeAlphabet, 8)
	return c[:4] + "-" + c[4:]
}

// NormalizeDeviceCode accepts user input such as "k7q2 9m4x" or "K7Q29M4X".
func NormalizeDeviceCode(s string) string {
	s = strings.ToUpper(strings.Map(func(r rune) rune {
		if r == '-' || r == ' ' {
			return -1
		}
		return r
	}, s))
	if len(s) != 8 {
		return s
	}
	return s[:4] + "-" + s[4:]
}

// Secret returns n random bytes, hex encoded.
func Secret(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}

// HashKey derives the stored form of an API key. Keys are high entropy, so a
// keyed hash (with a server-side pepper) is enough; no slow KDF is needed.
func HashKey(pepper, key string) string {
	m := hmac.New(sha256.New, []byte(pepper))
	m.Write([]byte(key))
	return hex.EncodeToString(m.Sum(nil))
}
