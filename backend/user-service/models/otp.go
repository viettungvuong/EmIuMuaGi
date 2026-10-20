package models

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"time"
)

// How long a code stays valid. It is also the Redis TTL, so Redis drops it then.
const OTPTTL = 5 * time.Minute

// What Redis keeps under otp:<email>. The code itself is never stored, only its SHA-256.
type OTP struct {
	HashedOTP string    `json:"hashed_otp"`
	ExpiresAt time.Time `json:"expires_at"`
}

// NewOTPCode returns a random 6-digit code, leading zeros included. crypto/rand
// is Go's counterpart to Python's secrets.
func NewOTPCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}
