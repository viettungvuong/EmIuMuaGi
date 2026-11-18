package internal

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// Expo's push service, which passes messages on to FCM (Android) and APNs (iOS)
// for the app's push tokens (mobile/src/notifications.js)
const (
	expoPushURL   = "https://exp.host/--/api/v2/push/send"
	expoBatchSize = 100 // the most Expo takes in one request
	expoTimeout   = 15 * time.Second
)

// The Android channel the app creates for these (mobile/src/notifications.js)
const PushChannel = "digest"

type PushMessage struct {
	To        string         `json:"to"`
	Title     string         `json:"title,omitempty"`
	Body      string         `json:"body"`
	Sound     string         `json:"sound,omitempty"`
	ChannelID string         `json:"channelId,omitempty"`
	Priority  string         `json:"priority,omitempty"`
	Data      map[string]any `json:"data,omitempty"`
}

// What Expo answers for each message, in the order they were sent
type pushTicket struct {
	Status  string `json:"status"` // "ok" or "error"
	Message string `json:"message"`
	Details struct {
		Error string `json:"error"` // e.g. DeviceNotRegistered
	} `json:"details"`
}

// IsExpoPushToken tells an Expo push token ("ExponentPushToken[...]") from anything else
func IsExpoPushToken(token string) bool {
	return len(token) <= 255 && strings.HasSuffix(token, "]") &&
		(strings.HasPrefix(token, "ExponentPushToken[") || strings.HasPrefix(token, "ExpoPushToken["))
}

// SendPush hands the messages to Expo. It returns the tokens Expo says no longer
// reach a phone (the app was uninstalled), for the caller to forget.
func SendPush(ctx context.Context, messages []PushMessage) (gone []string, err error) {
	var errs []error
	for start := 0; start < len(messages); start += expoBatchSize {
		batch := messages[start:min(start+expoBatchSize, len(messages))]

		tickets, err := postPushBatch(ctx, batch)
		if err != nil {
			errs = append(errs, err)
			continue
		}

		for i, ticket := range tickets {
			if ticket.Status != "error" || i >= len(batch) {
				continue
			}
			if ticket.Details.Error == "DeviceNotRegistered" {
				gone = append(gone, batch[i].To)
			} else {
				log.Printf("[push] Expo refused a message: %s (%s)", ticket.Message, ticket.Details.Error)
			}
		}
	}
	return gone, errors.Join(errs...)
}

func postPushBatch(ctx context.Context, batch []PushMessage) ([]pushTicket, error) {
	payload, err := json.Marshal(batch)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(ctx, expoTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, expoPushURL, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	// Only needed once "Enhanced push security" is on for the project at expo.dev
	if token := os.Getenv("EXPO_ACCESS_TOKEN"); token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var body struct {
		Data   []pushTicket `json:"data"`
		Errors []struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("Expo answered %d with an unreadable body: %w", resp.StatusCode, err)
	}
	if resp.StatusCode != http.StatusOK || len(body.Errors) > 0 {
		if len(body.Errors) > 0 {
			return nil, fmt.Errorf("Expo answered %d: %s %s", resp.StatusCode, body.Errors[0].Code, body.Errors[0].Message)
		}
		return nil, fmt.Errorf("Expo answered %d", resp.StatusCode)
	}
	return body.Data, nil
}
