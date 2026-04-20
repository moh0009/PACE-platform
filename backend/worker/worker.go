package worker

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/moh0009/file-upload-fullstack-task/backend/queue"
	"github.com/redis/go-redis/v9"
)

type WorkerManager struct {
	queue     *queue.RedisQueue
	workerID  string
	maxW      int
	ctx       context.Context
	cancel    context.CancelFunc
	wg        sync.WaitGroup
	processFn func(context.Context, *queue.ProcessJob) error
}

func NewWorkerManager(rdb *redis.Client, maxWorkers int, processFn func(context.Context, *queue.ProcessJob) error) *WorkerManager {
	ctx, cancel := context.WithCancel(context.Background())
	return &WorkerManager{
		queue:     queue.NewRedisQueue(rdb, 3),
		workerID:  fmt.Sprintf("csv-wkr-%s", uuid.New().String()[:8]),
		maxW:      maxWorkers,
		ctx:       ctx,
		cancel:    cancel,
		processFn: processFn,
	}
}

func (wm *WorkerManager) Start() {
	fmt.Printf("🚀 Worker %s starting (%d workers)\n", wm.workerID, wm.maxW)

	// Recover stale jobs first
	if recovered, err := wm.queue.RecoverStaleJobs(wm.ctx); err == nil && len(recovered) > 0 {
		fmt.Printf("♻️ Recovered %d jobs\n", len(recovered))
	}

	// Heartbeat loop
	wm.wg.Add(1)
	go wm.heartbeatLoop()

	// Recovery monitor
	wm.wg.Add(1)
	go wm.recoveryLoop()

	// Worker pool
	for i := 0; i < wm.maxW; i++ {
		wm.wg.Add(1)
		go wm.worker(i)
	}
}

func (wm *WorkerManager) worker(id int) {
	defer wm.wg.Done()
	fmt.Printf("👷 Worker %s-%d ready\n", wm.workerID, id)

	for {
		select {
		case <-wm.ctx.Done():
			return
		default:
		}

		job, err := wm.queue.Dequeue(wm.ctx, wm.workerID)
		if err != nil {
			if err == redis.Nil {
				time.Sleep(100 * time.Millisecond)
				continue
			}
			continue
		}

		jobCtx, cancel := context.WithTimeout(wm.ctx, 30*time.Minute)
		err = wm.processFn(jobCtx, job)
		cancel()

		if err != nil {
			fmt.Printf("💥 Job %s failed: %v\n", job.ID, err)
			wm.queue.UpdateStatus(wm.ctx, job.ID, queue.JobFailed, err.Error())
		} else {
			fmt.Printf("✅ Job %s completed\n", job.ID)
			wm.queue.UpdateStatus(wm.ctx, job.ID, queue.JobCompleted, "")
		}
	}
}

func (wm *WorkerManager) heartbeatLoop() {
	defer wm.wg.Done()
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-wm.ctx.Done():
			return
		case <-ticker.C:
			_ = wm.queue.Heartbeat(wm.ctx, wm.workerID)
		}
	}
}

func (wm *WorkerManager) recoveryLoop() {
	defer wm.wg.Done()
	ticker := time.NewTicker(45 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-wm.ctx.Done():
			return
		case <-ticker.C:
			if r, _ := wm.queue.RecoverStaleJobs(wm.ctx); len(r) > 0 {
				fmt.Printf("♻️ Auto-recovered %d jobs\n", len(r))
			}
		}
	}
}

func (wm *WorkerManager) Shutdown() {
	wm.cancel()
	wm.wg.Wait()
}
