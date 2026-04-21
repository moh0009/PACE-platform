package config

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

type Config struct {
	DatabaseURL     string
	RedisAddr       string
	RedisPassword   string
	ServerPort      string
	UploadsDir      string
	MaxFileSize     int64
	ChunkSize       int64
	WorkerCount     int
	QueueMaxRetries int
	HeartbeatTTL    time.Duration
}

func Load() *Config {
	// Load .env file if it exists (useful for local development)
	// Ignore error if .env doesn't exist (for Docker/production environments)
	_ = godotenv.Load()

	// Determine database URL: support both individual DB_* vars and DATABASE_URL
	databaseURL := buildDatabaseURL()

	cfg := &Config{
		DatabaseURL:     databaseURL,
		RedisAddr:       getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword:   getEnv("REDIS_PASSWORD", ""),
		ServerPort:      getEnv("SERVER_PORT", "8080"),
		UploadsDir:      getEnv("UPLOADS_DIR", "./uploads"),
		MaxFileSize:     getEnvInt64("MAX_FILE_SIZE", 2147483648), // 2GB
		ChunkSize:       getEnvInt64("CHUNK_SIZE", 5*1024*1024),   // 5MB
		WorkerCount:     getEnvInt("WORKER_COUNT", 4),
		QueueMaxRetries: getEnvInt("QUEUE_MAX_RETRIES", 3),
		HeartbeatTTL:    getEnvDuration("HEARTBEAT_TTL", 30*time.Second),
	}
	return cfg
}

// buildDatabaseURL constructs PostgreSQL connection string from individual DB_* vars or uses DATABASE_URL
func buildDatabaseURL() string {
	// If DATABASE_URL is explicitly set, use it
	if dbURL := os.Getenv("DATABASE_URL"); dbURL != "" {
		return dbURL
	}

	// Otherwise, build from individual DB_* variables
	dbHost := getEnv("DB_HOST", "localhost")
	dbPort := getEnv("DB_PORT", "5432")
	dbUser := getEnv("DB_USER", "postgres")
	dbPassword := getEnv("DB_PASSWORD", "postgres")
	dbName := getEnv("DB_NAME", "students_db")

	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?pool_max_conns=40&pool_min_conns=10&statement_timeout=30000",
		dbUser, dbPassword, dbHost, dbPort, dbName,
	)
}

func (c *Config) InitDatabase() *pgxpool.Pool {
	dbpool, err := pgxpool.New(context.Background(), c.DatabaseURL)
	if err != nil {
		log.Fatalf("Database connection error: %v", err)
	}

	// Initialize tables if they don't exist
	initSchema(dbpool)

	return dbpool
}

func initSchema(pool *pgxpool.Pool) {
	query := `
		CREATE TABLE IF NOT EXISTS students_staging (
			id TEXT,
			name TEXT,
			subject TEXT,
			grade TEXT
		);
		CREATE TABLE IF NOT EXISTS students (
			id SERIAL PRIMARY KEY,
			name TEXT,
			subject TEXT,
			grade INTEGER
		);
	`
	_, err := pool.Exec(context.Background(), query)
	if err != nil {
		log.Fatalf("Failed to initialize database schema: %v", err)
	}
	log.Println("Database schema initialized successfully")
}

func (c *Config) InitRedis() *redis.Client {
	rdb := redis.NewClient(&redis.Options{
		Addr:         c.RedisAddr,
		Password:     c.RedisPassword,
		DB:           0,
		PoolSize:     20,
		MinIdleConns: 5,
	})
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		log.Fatalf("Redis connection error: %v", err)
	}
	return rdb
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvInt64(key string, defaultValue int64) int64 {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.ParseInt(value, 10, 64); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}
