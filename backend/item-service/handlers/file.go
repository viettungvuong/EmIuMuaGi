package handlers

import (
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const uploadDir = "./uploads"

// filePayload holds the pre-read bytes and metadata so goroutines
// don't touch *gin.Context after the handler returns.
type filePayload struct {
	data     []byte
	filename string
}

// UploadItemFiles handles file uploads for an item.
// It immediately reads all files from the request (safe — still in handler scope),
// then saves them to disk concurrently in goroutines.
//
// POST /api/items/:item_id/files
// Content-Type: multipart/form-data
// Field name: "files" (supports multiple)
func UploadItemFiles(c *gin.Context) {
	itemID := c.Param("item_id") // files (images, videos for an item)

	// Parse the multipart form — limit total size to 50 MB (50 << 20)
	if err := c.Request.ParseMultipartForm(50 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse form: " + err.Error()})
		return
	}

	formFiles := c.Request.MultipartForm.File["files"]
	if len(formFiles) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No files provided under field 'files'"})
		return
	}

	// ── Step 1: Read all file bytes NOW, while still inside the handler ──
	// This is the critical step — we must not let goroutines read from c.Request.
	payloads := make([]filePayload, 0, len(formFiles))
	for _, fh := range formFiles { // read each file
		data, err := readFileHeader(fh)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file: " + fh.Filename})
			return
		}
		payloads = append(payloads, filePayload{
			data:     data,
			filename: fh.Filename,
		})
	}

	// ── Step 2: Respond immediately — client doesn't wait for disk writes ──
	c.JSON(http.StatusAccepted, gin.H{
		"message":    "Upload is being proceeded in background",
		"item_id":    itemID,
		"file_count": len(payloads),
	})

	// ── Step 3: Save files concurrently in goroutines ──
	// Each file gets its own goroutine. WaitGroup used for structured cleanup/logging.
	var wg sync.WaitGroup
	destDir := filepath.Join(uploadDir, itemID)

	if err := os.MkdirAll(destDir, 0755); err != nil {
		log.Printf("[upload] Failed to create dir %s: %v", destDir, err)
		return
	}

	for _, p := range payloads {
		wg.Add(1)                      // increase count of goroutines
		go func(payload filePayload) { // start goroutine here
			defer wg.Done() // no matter how the function ends (success or fail), wg.Done() is gone through
			if _, err := saveFile(destDir, payload); err != nil {
				log.Printf("[upload] Failed to save %s: %v", payload.filename, err)
			} else {
				log.Printf("[upload] Saved %s for item %s", payload.filename, itemID)
			}
		}(p) // pass by value — no shared state, no race
	}

	// Wait in a separate goroutine so the HTTP response is already sent
	go func() {
		wg.Wait() // block the code from continue until goroutine count is 0 (put into goroutine to not block the whole program)
		log.Printf("[upload] All %d file(s) saved for item %s", len(payloads), itemID)
	}()
}

// readFileHeader opens and fully reads a multipart.FileHeader into a []byte.
func readFileHeader(fh *multipart.FileHeader) ([]byte, error) {
	f, err := fh.Open()
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return io.ReadAll(f)
}

// saveFile writes a filePayload to disk with a unique timestamped name.
func saveFile(dir string, p filePayload) (string, error) {
	// Prepend timestamp to avoid collisions
	name := fmt.Sprintf("%d_%s", time.Now().UnixNano(), filepath.Base(p.filename))
	dest := filepath.Join(dir, name)

	f, err := os.Create(dest)
	if err != nil {
		return "", err
	}
	defer f.Close()

	_, err = f.Write(p.data)
	return dest, nil
}

func Deletefile(c *gin.Context) {
	itemID := c.Param("item_id")
	fileName := c.Param("file_name")

	filePath := filepath.Join(uploadDir, itemID, fileName)

	if err := os.Remove(filePath); err != nil {
		if os.IsNotExist(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not delete file", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "File deleted successfully",
		"item_id":   itemID,
		"file_name": fileName,
	})
}
