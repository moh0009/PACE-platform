package handlers

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/moh0009/file-upload-fullstack-task/backend/progress"
	"github.com/moh0009/file-upload-fullstack-task/backend/queue"
	"golang.org/x/sync/errgroup"
)

type ProcessMeta struct {
	FileName string `form:"fileName" json:"fileName"`
	FileID   string `form:"fileId" json:"fileId"`
	UserID   string `form:"userId" json:"userId"`
}

func (h *Handler) ProcessPost(c *gin.Context) {
	var meta ProcessMeta
	if err := c.ShouldBind(&meta); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	priority := 5 // default
	if strings.Contains(meta.UserID, "premium") {
		priority = 10
	}
	if strings.Contains(meta.UserID, "free") {
		priority = 0
	}

	job := &queue.ProcessJob{
		ID:       meta.FileID, // Use fileId from frontend as job ID
		UserID:   meta.UserID,
		FileName: meta.FileName,
		Priority: priority,
	}

	if err := h.Queue.Enqueue(c.Request.Context(), job); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "queue full"})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"job_id":      meta.FileID,
		"message":     "queued",
		"progress_ws": fmt.Sprintf("/ws/progress?fileId=%s", meta.FileID),
	})
}

func (h *Handler) ProcessFileWithRedis(ctx context.Context, job *queue.ProcessJob) error {
	tracker := NewProgressTracker(h.ProgressHub, job.ID)
	defer tracker.Complete()

	filePath := filepath.Join("./uploads", job.FileName)
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("open file: %w", err)
	}
	defer file.Close()

	info, _ := file.Stat()
	pr := NewProgressReader(bufio.NewReaderSize(file, 64*1024), tracker, info.Size())
	if err := h.CopyToStaging(ctx, pr); err != nil {
		return fmt.Errorf("copy: %w", err)
	}

	tracker.Update("moving", 100, 0, nil)
	if err := h.MoveToMainTableParallel(ctx, tracker); err != nil {
		return fmt.Errorf("move: %w", err)
	}

	os.Remove(filePath)
	tracker.Update("complete", 100, 100, nil)
	return nil
}

func (h *Handler) CopyToStaging(ctx context.Context, pr io.Reader) error {
	conn, err := h.Db.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	_, err = conn.Conn().PgConn().CopyFrom(
		ctx, pr,
		"COPY students_staging (id, name, subject, grade) FROM STDIN WITH (FORMAT csv, HEADER true)",
	)
	if err != nil && err != io.EOF {
		return err
	}
	return nil
}

func (h *Handler) MoveToMainTableParallel(ctx context.Context, tracker *ProgressTracker) error {
	const batchSize = 10000
	const maxWorkers = 4

	g, ctx := errgroup.WithContext(ctx)
	g.SetLimit(maxWorkers)

	// Get approximate row count
	var total int64
	h.Db.QueryRow(ctx, "SELECT count(*) FROM students_staging").Scan(&total)
	tracker.SetTotal(total)
	tracker.Update("moving", 100, 0, nil)

	for offset := int64(0); offset < total; offset += batchSize {
		g.Go(func() error {
			rows, err := h.ProcessBatchCTE(ctx, batchSize)
			if err != nil {
				return err
			}
			if rows > 0 {
				tracker.AddRows(rows)
				processed := atomic.LoadInt64(&tracker.processed)
				totalAtomic := atomic.LoadInt64(&tracker.total)
				if totalAtomic > 0 {
					pct := float64(processed) / float64(totalAtomic) * 100
					tracker.Update("moving", 100, pct, nil)
				}
			}
			return nil
		})
	}
	return g.Wait()
}

func (h *Handler) ProcessBatchCTE(ctx context.Context, limit int) (int64, error) {
	var moved int64
	err := h.Db.QueryRow(ctx, `
		WITH validated AS (
			SELECT ctid, name, subject, CAST(grade AS INTEGER) as grade_int
			FROM students_staging
			WHERE name IS NOT NULL AND btrim(name) != ''
			  AND subject IS NOT NULL AND btrim(subject) != ''
			  AND grade ~ '^[0-9]+$'
			LIMIT $1
		),
		deleted AS (
			DELETE FROM students_staging s
			USING validated v
			WHERE s.ctid = v.ctid
			RETURNING v.name, v.subject, v.grade_int
		),
		inserted AS (
			INSERT INTO students (name, subject, grade)
			SELECT name, subject, grade_int FROM deleted
			RETURNING 1
		)
		SELECT COUNT(*) FROM inserted;
	`, limit).Scan(&moved)
	return moved, err
}

// -------------------- PROGRESS TRACKER --------------------
type ProgressTracker struct {
	hub       *progress.RedisProgressHub
	jobID     string
	total     int64
	processed int64
	lastPct   int
	throttle  time.Duration
	lastSend  time.Time
	lastStage string
	mu        sync.Mutex
}

func NewProgressTracker(hub *progress.RedisProgressHub, jobID string) *ProgressTracker {
	return &ProgressTracker{
		hub:      hub,
		jobID:    jobID,
		throttle: 200 * time.Millisecond,
	}
}

func (p *ProgressTracker) SetTotal(n int64) { atomic.StoreInt64(&p.total, n) }
func (p *ProgressTracker) AddRows(n int64)  { atomic.AddInt64(&p.processed, n) }

func (p *ProgressTracker) Update(stage string, upPct, procPct float64, extra map[string]interface{}) {
	fmt.Printf("DEBUG: ProgressTracker.Update(jobID=%s, stage=%s, up=%f, proc=%f)\n", p.jobID, stage, upPct, procPct)
	p.mu.Lock()
	defer p.mu.Unlock()

	// Bypass throttle if stage has changed or it's the final update
	if stage == p.lastStage && stage != "complete" && time.Since(p.lastSend) < p.throttle {
		return
	}
	p.lastSend = time.Now()
	p.lastStage = stage

	data := map[string]interface{}{
		"stage":       stage,
		"upload_pct":  upPct,
		"process_pct": procPct,
		"rows":        atomic.LoadInt64(&p.processed),
	}
	for k, v := range extra {
		data[k] = v
	}
	_ = p.hub.Publish(context.Background(), p.jobID, data)
}

func (p *ProgressTracker) Complete() {
	p.Update("complete", 100, 100, nil)
}

type ProgressReader struct {
	io.Reader
	tracker *ProgressTracker
	size    int64
	read    int64
}

func NewProgressReader(r io.Reader, t *ProgressTracker, size int64) *ProgressReader {
	return &ProgressReader{Reader: r, tracker: t, size: size}
}

func (pr *ProgressReader) Read(p []byte) (int, error) {
	n, err := pr.Reader.Read(p)
	if n > 0 {
		atomic.AddInt64(&pr.read, int64(n))
		read := atomic.LoadInt64(&pr.read)
		pct := float64(read) / float64(pr.size) * 100
		pr.tracker.Update("parsing", pct, 0, nil)
	}
	return n, err
}
