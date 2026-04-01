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

var uploadTasks sync.Map // tracks status: map[string]string (taskID -> "pending", "completed", "failed")

// filePayload holds the pre-read bytes and metadata so goroutines
type filePayload struct {
	data     []byte
	filename string
	taskID   string // track individual file progress
}

// UploadItemFiles handles file uploads for an item.
// It immediately reads all files from the request (safe — still in handler scope),
// then saves them to disk concurrently in goroutines.
//
// POST /api/items/:item_id/files
// Content-Type: multipart/form-data
// Field name: "files" (supports multiple)
func UploadItemFiles(c *gin.Context) {
	itemID := c.Param("item_id")
	formFiles := c.Request.MultipartForm.File["files"]

	payloads := make([]filePayload, 0, len(formFiles))
	taskIDs := make([]string, 0, len(formFiles)) // return to the client for later polling

	for _, fh := range formFiles {
		data, err := readFileHeader(fh)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
			return
		}

		// Create custom task_id: filename + nanosecond timestamp
		customTaskID := fmt.Sprintf("%s_%d", fh.Filename, time.Now().UnixNano())

		payloads = append(payloads, filePayload{
			data:     data,
			filename: fh.Filename,
			taskID:   customTaskID,
		})
		taskIDs = append(taskIDs, customTaskID)
		uploadTasks.Store(customTaskID, "pending") // Initialize task status
	}

	destDir := filepath.Join(uploadDir, itemID)
	if err := os.MkdirAll(destDir, 0755); err != nil {
		log.Printf("[upload] Failed to create dir: %v", err)
		return
	}

	// ── Step 3: Respond with the list of Task IDs ──
	c.JSON(http.StatusAccepted, gin.H{
		"message":  "Files are processing",
		"item_id":  itemID,
		"task_ids": taskIDs, // use for polling the status
	})

	var wg sync.WaitGroup
	for _, p := range payloads {
		wg.Add(1)
		// The 'p' inside the ( ) is what creates the connection.
		// It tells Go: "Take the current value of 'p' and give it to this specific goroutine."
		go func(payload filePayload) {
			defer wg.Done()

			// Use the specific TaskID assigned to this goroutine
			if dest, err := saveFile(destDir, payload); err != nil {
				log.Printf("[upload][Task:%s] Failed: %v", payload.taskID, err)
				uploadTasks.Store(payload.taskID, "failed")
			} else {
				log.Printf("[upload][Task:%s] Success for %s -> %s", payload.taskID, payload.filename, dest)
				uploadTasks.Store(payload.taskID, "completed")
			}
		}(p) // pass current p to payload param
	}

	go func() {
		wg.Wait()
		log.Printf("[upload] Finished all tasks for item %s", itemID)

		// Garbage collection: If the client drops connection/closes browser
		// and never polls the result, these will stay in the map forever.
		// Wait 5 minutes to give the frontend plenty of time to poll it normally,
		// then forcibly evict them.
		timeoutMinute := 5
		time.Sleep(time.Duration(timeoutMinute) * time.Minute)
		for _, taskID := range taskIDs {
			checkTask(taskID)
		}
	}()
}

func checkTask(taskID string) {
	status, exists := uploadTasks.Load(taskID)
	if !exists {
		log.Printf("Task %s does not exists", taskID)
		return
	}

	if status == "completed" || status == "failed" {
		uploadTasks.Delete(taskID) // delete task from map
	}
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

func TaskStatus(c *gin.Context) {
	taskID := c.Param("task_id")

	status, exists := uploadTasks.Load(taskID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"task_id": taskID,
		"status":  status,
	})

	checkTask(taskID) // evict task if done
}
