package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/viettungvuong/emiumuagi-backend/internal"
)

// RefreshPrices starts reading the prices off the shop links on the caller's and
// their partner's list, for the user service as they sign in, and answers
// straight away (internal/prices.go). Not routed by the gateway.
func RefreshPrices(c *gin.Context) {
	owners, err := internal.OwnerScope(c)
	if err != nil {
		log.Printf("[prices] %s: could not resolve partner, reading own items only: %v", c.GetString("username"), err)
	}

	internal.RefreshPrices(owners)
	c.Status(http.StatusAccepted)
}
