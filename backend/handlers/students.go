package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/moh0009/file-upload-fullstack-task/backend/errors"
)

type StudentDB struct {
	ID      int    `json:"id"`
	Name    string `json:"name"`
	Subject string `json:"subject"`
	Grade   int    `json:"grade"`
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

	row := h.Db.QueryRow(context.Background(), query, args...)
	var count int
	if err := row.Scan(&count); err != nil {
		appErr := errors.Wrap(err, errors.ErrorTypeDatabase, "DB_QUERY_FAILED", "Failed to count students", http.StatusInternalServerError)
		c.JSON(appErr.StatusCode, errors.NewErrorResponse(appErr))
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

func (h *Handler) GetStudents(c *gin.Context) {
	pageSizeStr := c.Query("pageSize")
	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize <= 0 || pageSize > 1000 {
		appErr := errors.NewInvalidInputError("pageSize", "must be a positive integer between 1 and 1000")
		c.JSON(appErr.StatusCode, errors.NewErrorResponse(appErr))
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

	// Security: Validate sort column
	allowedColumns := map[string]bool{"id": true, "name": true, "subject": true, "grade": true}

	sortCol := "id"
	isDesc := false
	if sortBy != "" {
		parts := strings.Split(strings.TrimSpace(sortBy), " ")
		if allowedColumns[parts[0]] {
			sortCol = parts[0]
		}
		if len(parts) > 1 && strings.ToUpper(parts[1]) == "DESC" {
			isDesc = true
		}
	}

	query := "SELECT id, name, subject, grade FROM students"
	var args []interface{}
	argCount := 1

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

	// Keyset pagination logic
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

	rows, err := h.Db.Query(context.Background(), query, args...)
	if err != nil {
		appErr := errors.Wrap(err, errors.ErrorTypeDatabase, "DB_QUERY_FAILED", "Failed to retrieve students", http.StatusInternalServerError)
		c.JSON(appErr.StatusCode, errors.NewErrorResponse(appErr))
		return
	}
	defer rows.Close()

	var students []StudentDB
	for rows.Next() {
		var student StudentDB
		if err := rows.Scan(&student.ID, &student.Name, &student.Subject, &student.Grade); err != nil {
			appErr := errors.Wrap(err, errors.ErrorTypeDatabase, "DB_SCAN_FAILED", "Failed to process student data", http.StatusInternalServerError)
			c.JSON(appErr.StatusCode, errors.NewErrorResponse(appErr))
			return
		}
		students = append(students, student)
	}

	if err := rows.Err(); err != nil {
		appErr := errors.Wrap(err, errors.ErrorTypeDatabase, "DB_ITERATION_FAILED", "Error iterating through results", http.StatusInternalServerError)
		c.JSON(appErr.StatusCode, errors.NewErrorResponse(appErr))
		return
	}

	if beforeIdStr != "" {
		for i, j := 0, len(students)-1; i < j; i, j = i+1, j-1 {
			students[i], students[j] = students[j], students[i]
		}
	}

	c.JSON(http.StatusOK, students)
}

func (h *Handler) DeleteStudent(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		appErr := errors.NewInvalidInputError("id", "must be a positive integer")
		c.JSON(appErr.StatusCode, errors.NewErrorResponse(appErr))
		return
	}

	result, err := h.Db.Exec(context.Background(), "DELETE FROM students WHERE id = $1", id)
	if err != nil {
		appErr := errors.Wrap(err, errors.ErrorTypeDatabase, "DB_DELETE_FAILED", "Failed to delete student", http.StatusInternalServerError)
		c.JSON(appErr.StatusCode, errors.NewErrorResponse(appErr))
		return
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		appErr := errors.NewRecordNotFoundError("Student", id)
		c.JSON(appErr.StatusCode, errors.NewErrorResponse(appErr))
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Student deleted successfully"})
}

func (h *Handler) UpdateStudent(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		appErr := errors.NewInvalidInputError("id", "must be a positive integer")
		c.JSON(appErr.StatusCode, errors.NewErrorResponse(appErr))
		return
	}

	var student StudentDB
	if err := c.ShouldBindJSON(&student); err != nil {
		appErr := errors.Wrap(err, errors.ErrorTypeValidation, "INVALID_JSON", "Invalid request body format", http.StatusBadRequest)
		c.JSON(appErr.StatusCode, errors.NewErrorResponse(appErr))
		return
	}

	// Validate required fields
	if student.Name == "" {
		appErr := errors.NewMissingRequiredFieldError("name")
		c.JSON(appErr.StatusCode, errors.NewErrorResponse(appErr))
		return
	}
	if student.Subject == "" {
		appErr := errors.NewMissingRequiredFieldError("subject")
		c.JSON(appErr.StatusCode, errors.NewErrorResponse(appErr))
		return
	}
	if student.Grade < 0 || student.Grade > 100 {
		appErr := errors.NewInvalidInputError("grade", "must be between 0 and 100")
		c.JSON(appErr.StatusCode, errors.NewErrorResponse(appErr))
		return
	}

	result, err := h.Db.Exec(context.Background(), "UPDATE students SET name = $1, subject = $2, grade = $3 WHERE id = $4", student.Name, student.Subject, student.Grade, id)
	if err != nil {
		appErr := errors.Wrap(err, errors.ErrorTypeDatabase, "DB_UPDATE_FAILED", "Failed to update student", http.StatusInternalServerError)
		c.JSON(appErr.StatusCode, errors.NewErrorResponse(appErr))
		return
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		appErr := errors.NewRecordNotFoundError("Student", id)
		c.JSON(appErr.StatusCode, errors.NewErrorResponse(appErr))
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Student updated successfully"})
}
