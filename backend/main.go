package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for now
	},
}

var (
	clients   = make(map[string]*websocket.Conn)
	clientsMu sync.Mutex
)

type Student_DB struct {
	ID      int    `json:"id"`
	Name    string `json:"name"`
	Subject string `json:"subject"`
	Grade   int    `json:"grade"`
}

type ChunkMeta struct {
	ChunkIndex  int    `form:"chunkIndex"`
	TotalChunks int    `form:"totalChunks"`
	FileName    string `form:"fileName"`
	FileID      string `form:"fileId"`
}

type MergeMeta struct {
	FileName    string `form:"fileName"`
	TotalChunks int    `form:"totalChunks"`
}

type Handler struct {
	db *pgxpool.Pool
}

func sendWSMessage(fileID string, msg interface{}) {
	clientsMu.Lock()
	defer clientsMu.Unlock()
	if ws, ok := clients[fileID]; ok {
		ws.WriteJSON(msg)
	}
}

func MergeChunks(fileName string, totalChunks int) error {
	finalPath := "./uploads/" + fileName

	finalFile, err := os.Create(finalPath)
	if err != nil {
		return err
	}
	defer finalFile.Close()

	for i := range totalChunks {
		chunkPath := fmt.Sprintf("./uploads/%s.part_%d", fileName, i)

		chunkFile, err := os.Open(chunkPath)
		if err != nil {
			return err
		}
		_, err = io.Copy(finalFile, chunkFile)
		chunkFile.Close()
		if err != nil {
			return err
		}

		os.Remove(chunkPath) // cleanup
	}

	return nil
}

func uploadFiles(c *gin.Context) {
	var meta ChunkMeta

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	c.ShouldBind(&meta)
	if !strings.HasSuffix(strings.ToLower(meta.FileName), ".csv") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file type"})
		return
	}

	chunkPath := fmt.Sprintf("./uploads/%s.part_%d", meta.FileName, meta.ChunkIndex)

	if err := c.SaveUploadedFile(file, chunkPath); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	progress := int(float64(meta.ChunkIndex+1) / float64(meta.TotalChunks) * 100)

	sendWSMessage(meta.FileID, gin.H{"type": "upload", "progress": progress})

	if meta.ChunkIndex == meta.TotalChunks-1 {
		err := MergeChunks(meta.FileName, meta.TotalChunks)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "All files uploaded successfully, Processing ..."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "file Uploaded successfully"})
}

func handleProgressWS(c *gin.Context) {
	fileID := c.Query("fileId")
	if fileID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "fileId is required"})
		return
	}

	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		fmt.Println("Error upgrading to websocket:", err)
		return
	}

	clientsMu.Lock()
	clients[fileID] = ws
	clientsMu.Unlock()

	defer func() {
		clientsMu.Lock()
		delete(clients, fileID)
		clientsMu.Unlock()
		ws.Close()
	}()

	for {
		if _, _, err := ws.ReadMessage(); err != nil {
			break
		}
	}
}

func (h *Handler) GetStudentsCount(c *gin.Context) {
	nameSearch := c.Query("name")
	subjectSearch := c.Query("subject")
	gradeMinStr := c.Query("gradeMin")
	gradeMaxStr := c.Query("gradeMax")

	query := "SELECT count(*) FROM students"
	whereClauses := []string{}
	var args []interface{}
	argCount := 1

	if nameSearch != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("name LIKE $%d", argCount))
		args = append(args, "%"+nameSearch+"%")
		argCount++
	}
	if subjectSearch != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("subject = $%d", argCount))
		args = append(args, subjectSearch)
		argCount++
	}
	if gradeMinStr != "" {
		val, _ := strconv.Atoi(gradeMinStr)
		whereClauses = append(whereClauses, fmt.Sprintf("grade >= $%d", argCount))
		args = append(args, val)
		argCount++
	}
	if gradeMaxStr != "" {
		val, _ := strconv.Atoi(gradeMaxStr)
		whereClauses = append(whereClauses, fmt.Sprintf("grade <= $%d", argCount))
		args = append(args, val)
		argCount++
	}

	if len(whereClauses) > 0 {
		query += " WHERE " + strings.Join(whereClauses, " AND ")
	}

	row := h.db.QueryRow(context.Background(), query, args...)
	var count int
	if err := row.Scan(&count); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

func (h *Handler) GetStudents(c *gin.Context) {
	pageSizeStr := c.Query("pageSize")
	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid page size"})
		return
	}

	sortBy := c.Query("sortBy")
	afterIdStr := c.Query("afterId")
	afterValue := c.Query("afterValue")
	beforeIdStr := c.Query("beforeId")
	beforeValue := c.Query("beforeValue")
	nameSearch := c.Query("name")
	subjectSearch := c.Query("subject")
	gradeMinStr := c.Query("gradeMin")
	gradeMaxStr := c.Query("gradeMax")

	// Determine sort column and direction
	sortCol := "id"
	isDesc := false
	if sortBy != "" {
		parts := strings.Split(strings.TrimSpace(sortBy), " ")
		sortCol = parts[0]
		if len(parts) > 1 && strings.ToUpper(parts[1]) == "DESC" {
			isDesc = true
		}
	}

	query := "SELECT * FROM students"
	var args []interface{}
	argCount := 1

	// Keyset Filtering
	whereClauses := []string{}

	if nameSearch != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("name LIKE $%d", argCount))
		args = append(args, "%"+nameSearch+"%")
		argCount++
	}
	if subjectSearch != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("subject = $%d", argCount))
		args = append(args, subjectSearch)
		argCount++
	}
	if gradeMinStr != "" {
		val, _ := strconv.Atoi(gradeMinStr)
		whereClauses = append(whereClauses, fmt.Sprintf("grade >= $%d", argCount))
		args = append(args, val)
		argCount++
	}
	if gradeMaxStr != "" {
		val, _ := strconv.Atoi(gradeMaxStr)
		whereClauses = append(whereClauses, fmt.Sprintf("grade <= $%d", argCount))
		args = append(args, val)
		argCount++
	}

	if afterIdStr != "" {
		afterId, _ := strconv.Atoi(afterIdStr)
		if sortCol == "id" {
			if isDesc {
				whereClauses = append(whereClauses, fmt.Sprintf("id < $%d", argCount))
				args = append(args, afterId)
			} else {
				whereClauses = append(whereClauses, fmt.Sprintf("id > $%d", argCount))
				args = append(args, afterId)
			}
			argCount++
		} else {
			operator := ">"
			if isDesc {
				operator = "<"
			}
			// (col, id) > (val, id) -> col > val OR (col = val AND id > id)
			// But Postgres supports row comparison: (col, id) > (val, id)
			whereClauses = append(whereClauses, fmt.Sprintf("(%s, id) %s ($%d, $%d)", sortCol, operator, argCount, argCount+1))
			args = append(args, afterValue, afterId)
			argCount += 2
		}
	} else if beforeIdStr != "" {
		beforeId, _ := strconv.Atoi(beforeIdStr)
		if sortCol == "id" {
			if isDesc {
				whereClauses = append(whereClauses, fmt.Sprintf("id > $%d", argCount))
				args = append(args, beforeId)
			} else {
				whereClauses = append(whereClauses, fmt.Sprintf("id < $%d", argCount))
				args = append(args, beforeId)
			}
			argCount++
		} else {
			operator := "<"
			if isDesc {
				operator = ">"
			}
			whereClauses = append(whereClauses, fmt.Sprintf("(%s, id) %s ($%d, $%d)", sortCol, operator, argCount, argCount+1))
			args = append(args, beforeValue, beforeId)
			argCount += 2
		}
	}

	if len(whereClauses) > 0 {
		query += " WHERE " + strings.Join(whereClauses, " AND ")
	}

	// Dynamic Order By
	orderDir := "ASC"
	if isDesc {
		orderDir = "DESC"
	}

	// If calculating "Before", we need to reverse the order for the DB query and then reverse in Go
	effectiveOrderDir := orderDir
	if beforeIdStr != "" {
		if isDesc {
			effectiveOrderDir = "ASC"
		} else {
			effectiveOrderDir = "DESC"
		}
	}

	if sortCol == "id" {
		query += fmt.Sprintf(" ORDER BY id %s", effectiveOrderDir)
	} else {
		query += fmt.Sprintf(" ORDER BY %s %s, id %s", sortCol, effectiveOrderDir, effectiveOrderDir)
	}

	query += fmt.Sprintf(" LIMIT $%d", argCount)
	args = append(args, pageSize)

	rows, err := h.db.Query(context.Background(), query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch students"})
		fmt.Println("Error fetching students:", err)
		return
	}
	defer rows.Close()

	var students []Student_DB
	for rows.Next() {
		var student Student_DB
		if err := rows.Scan(&student.ID, &student.Name, &student.Subject, &student.Grade); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch students"})
			fmt.Println("Error fetching students:", err)
			return
		}
		students = append(students, student)
	}

	if beforeIdStr != "" {
		for i, j := 0, len(students)-1; i < j; i, j = i+1, j-1 {
			students[i], students[j] = students[j], students[i]
		}
	}

	c.JSON(http.StatusOK, students)
}

func (h *Handler) deleteStudent(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid student ID"})
		return
	}

	_, err = h.db.Exec(context.Background(), "DELETE FROM students WHERE id = $1", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete student"})
		fmt.Println("Error deleting student:", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Student deleted successfully"})
}

func (h *Handler) updateStudent(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid student ID"})
		return
	}

	var student Student_DB
	if err := c.ShouldBindJSON(&student); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	_, err = h.db.Exec(context.Background(), "UPDATE students SET name = $1, subject = $2, grade = $3 WHERE id = $4", student.Name, student.Subject, student.Grade, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update student"})
		fmt.Println("Error updating student:", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Student updated successfully"})
}

func main() {
	// db conniction
	dbpool, err := pgxpool.New(context.Background(), "postgres://root:toor@localhost:5432/pace_db?pool_max_conns=10")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Unable to create connection pool: %v\n", err)
		os.Exit(1)
	}
	defer dbpool.Close()
	handler := &Handler{db: dbpool}
	router := gin.Default()
	router.Use(cors.New(cors.Config{
		AllowOrigins: []string{
			"http://localhost:3000",
			"http://127.0.0.1:3000",
			"http://192.168.1.182:3000",
		},
		AllowMethods: []string{
			"GET", "POST", "PUT", "DELETE", "OPTIONS",
		},
		AllowHeaders: []string{
			"Origin",
			"Content-Type",
			"Accept",
		},
		ExposeHeaders: []string{
			"Content-Length",
		},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}))
	{
		api := router.Group("/api")

		api.POST("/upload", uploadFiles)
		api.GET("/ws/progress", handleProgressWS)
		api.POST("/process", handler.processPost)
		{
			students := api.Group("/students")
			students.GET("/count", handler.GetStudentsCount)
			students.GET("", handler.GetStudents)
			students.DELETE("/:id", handler.deleteStudent)
			students.PUT("/:id", handler.updateStudent)
		}
	}
	router.Run(":8080")
}
