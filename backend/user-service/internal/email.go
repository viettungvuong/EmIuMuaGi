package internal

import (
	"bytes"
	"errors"
	"mime"
	"mime/multipart"
	"net/mail"
	"net/smtp"
	"net/textproto"
	"os"
	"time"
)

// SendEmail sends an email through the SMTP server set in the env:
// SMTP_HOST, SMTP_PORT (default 587, STARTTLS), SMTP_USERNAME, SMTP_PASSWORD and
// SMTP_FROM (defaults to SMTP_USERNAME; "EmIuMuaGi <noreply@example.com>" works).
// html is optional; text is always sent, for mail apps that don't show HTML.
func SendEmail(to, subject, text, html string) error {
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

	msg, err := buildMessage(from.String(), to, subject, text, html)
	if err != nil {
		return err
	}

	// SendMail upgrades to TLS when the server offers STARTTLS, and refuses to send
	// the password over a plain connection to anything but localhost
	return smtp.SendMail(host+":"+port, auth, from.Address, []string{to}, msg)
}

// buildMessage writes the headers and body. With html it sends both versions
// (multipart/alternative): mail apps show the HTML, or the text if they can't.
func buildMessage(from, to, subject, text, html string) ([]byte, error) {
	var buf bytes.Buffer
	buf.WriteString("From: " + from + "\r\n" +
		"To: " + to + "\r\n" +
		"Subject: " + mime.QEncoding.Encode("utf-8", subject) + "\r\n" +
		"Date: " + time.Now().Format(time.RFC1123Z) + "\r\n" +
		"MIME-Version: 1.0\r\n")

	if html == "" {
		buf.WriteString("Content-Type: text/plain; charset=UTF-8\r\n" +
			"Content-Transfer-Encoding: 8bit\r\n" +
			"\r\n" + text)
		return buf.Bytes(), nil
	}

	parts := multipart.NewWriter(&buf)
	buf.WriteString("Content-Type: multipart/alternative; boundary=" + parts.Boundary() + "\r\n\r\n")
	// Plainest first: a mail app shows the last version it understands
	for _, part := range []struct{ contentType, body string }{
		{"text/plain; charset=UTF-8", text},
		{"text/html; charset=UTF-8", html},
	} {
		w, err := parts.CreatePart(textproto.MIMEHeader{
			"Content-Type":              {part.contentType},
			"Content-Transfer-Encoding": {"8bit"},
		})
		if err != nil {
			return nil, err
		}
		if _, err := w.Write([]byte(part.body)); err != nil {
			return nil, err
		}
	}
	if err := parts.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
