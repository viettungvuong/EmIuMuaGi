package handlers

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type SignupRequest struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func pkcs7Unpad(data []byte, blockSize int) ([]byte, error) {
	length := len(data)
	if length == 0 || length%blockSize != 0 {
		return nil, os.ErrInvalid
	}
	padLen := int(data[length-1])
	if padLen > blockSize || padLen == 0 {
		return nil, os.ErrInvalid
	}
	padding := data[length-padLen:]
	for _, pad := range padding {
		if int(pad) != padLen {
			return nil, os.ErrInvalid
		}
	}
	return data[:length-padLen], nil
}

func decryptPassword(encB64 string) string {
	aesKeyStr := os.Getenv("AES_KEY")
	aesIVStr := os.Getenv("AES_IV")

	if aesKeyStr == "" || aesIVStr == "" {
		return ""
	}

	key := []byte(aesKeyStr)
	iv := []byte(aesIVStr)

	encBytes, err := base64.StdEncoding.DecodeString(encB64)
	if err != nil || len(encBytes) == 0 {
		return ""
	}
	if len(encBytes)%aes.BlockSize != 0 {
		return ""
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return ""
	}

	mode := cipher.NewCBCDecrypter(block, iv)
	decryptedBytes := make([]byte, len(encBytes))
	mode.CryptBlocks(decryptedBytes, encBytes)

	unpadded, err := pkcs7Unpad(decryptedBytes, aes.BlockSize)
	if err != nil {
		return ""
	}

	unpadded = bytes.TrimRight(unpadded, "\x00")

	return string(unpadded)
}

func SignUp(c *gin.Context) {

}

func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	appPassword := os.Getenv("APP_PASSWORD")

	decryptedPass := decryptPassword(req.Password)
	if req.Password == appPassword || decryptedPass == appPassword {
		c.JSON(http.StatusOK, AuthResponse{Success: true, Message: "Authenticated successfully"})
		return
	}

	c.JSON(http.StatusUnauthorized, gin.H{"detail": "Invalid password"})
}
