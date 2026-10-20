package internal

import (
	"errors"
	"mime"
	"net/mail"
	"net/smtp"
	"os"
	"time"
)

// SendEmail sends a plain-text email through the SMTP server set in the env:
// SMTP_HOST, SMTP_PORT (default 587, STARTTLS), SMTP_USERNAME, SMTP_PASSWORD and
// SMTP_FROM (defaults to SMTP_USERNAME; "EmIuMuaGi <noreply@example.com>" works).
func SendEmail(to, subject, body string) error {
	host := os.Getenv("SMTP_HOST")
	port := os.Getenv("SMTP_PORT")
	if port == "" {
		port = "587"
	}
	username := os.Getenv("SMTP_USERNAME")
	fromValue := os.Getenv("SMTP_FROM")
	if fromValue == "" {
		fromValue = username
	}
	if host == "" || fromValue == "" {
		return errors.New("email is not set up: SMTP_HOST and SMTP_FROM (or SMTP_USERNAME) are required")
	}

	from, err := mail.ParseAddress(fromValue)
	if err != nil {
		return err
	}

	var auth smtp.Auth
	if username != "" {
		auth = smtp.PlainAuth("", username, os.Getenv("SMTP_PASSWORD"), host)
	}

	msg := "From: " + from.String() + "\r\n" +
		"To: " + to + "\r\n" +
		"Subject: " + mime.QEncoding.Encode("utf-8", subject) + "\r\n" +
		"Date: " + time.Now().Format(time.RFC1123Z) + "\r\n" +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/plain; charset=UTF-8\r\n" +
		"Content-Transfer-Encoding: 8bit\r\n" +
		"\r\n" + body

	// SendMail upgrades to TLS when the server offers STARTTLS, and refuses to send
	// the password over a plain connection to anything but localhost
	return smtp.SendMail(host+":"+port, auth, from.Address, []string{to}, []byte(msg))
}
