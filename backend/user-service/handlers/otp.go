package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/viettungvuong/emiumuagi-user-service/database"
	"github.com/viettungvuong/emiumuagi-user-service/internal"
	"github.com/viettungvuong/emiumuagi-user-service/models"
)

// One code per email, so asking again replaces the previous one. Lowercased so
// "Tung@Gmail.com" and "tung@gmail.com" share it.
func otpKey(email string) string {
	return "otp:" + strings.ToLower(email)
}

// GenerateOTP emails a new 6-digit code to email. Redis keeps only its SHA-256,
// under otp:<email>, and drops it after models.OTPTTL.
func GenerateOTP(email string) error {
	code, err := models.NewOTPCode()
	if err != nil {
		return err
	}

	value, err := json.Marshal(models.OTP{
		HashedOTP: internal.HashOTP(code),
		ExpiresAt: time.Now().Add(models.OTPTTL),
	})
	if err != nil {
		return err
	}

	ctx := context.Background()
	key := otpKey(email)
	if err := database.RDB.Set(ctx, key, value, models.OTPTTL).Err(); err != nil {
		return err
	}

	minutes := int(models.OTPTTL.Minutes())
	body := fmt.Sprintf("Your EmIuMuaGi verification code is: %s\n\nIt expires in %d minutes. If you didn't request this code, you can ignore this email.", code, minutes)
	if err := internal.SendEmail(email, "Your EmIuMuaGi verification code", body); err != nil {
		// Nobody received this code, so don't leave it valid
		database.RDB.Del(ctx, key)
		return err
	}

	return nil
}

// VerifyOTP reports whether code is the latest one sent to email and has not
// expired. A correct code is deleted, so it works only once.
func VerifyOTP(email, code string) (bool, error) {
	ctx := context.Background()
	key := otpKey(email)

	value, err := database.RDB.Get(ctx, key).Bytes()
	if errors.Is(err, redis.Nil) {
		return false, nil // never sent, expired, or already used
	}
	if err != nil {
		return false, err
	}

	var otp models.OTP
	if err := json.Unmarshal(value, &otp); err != nil {
		return false, err
	}
	if time.Now().After(otp.ExpiresAt) || !internal.CheckOTPHash(code, otp.HashedOTP) {
		return false, nil
	}

	// Two requests can both read a valid code; only the one whose delete removes it wins
	deleted, err := database.RDB.Del(ctx, key).Result()
	if err != nil {
		return false, err
	}
	return deleted == 1, nil
}
