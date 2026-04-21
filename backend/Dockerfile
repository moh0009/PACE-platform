# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM golang:alpine AS builder

# Install upx to compress the binary
RUN apk add --no-cache upx

WORKDIR /build

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build a statically-linked binary and compress it with UPX.
# -ldflags "-s -w" removes symbol tables and debug information.
RUN GIN_MODE=release go build -ldflags="-s -w" -o server .
# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM gcr.io/distroless/static-debian12

WORKDIR /app

# Copy the compressed binary
COPY --from=builder /build/server .

EXPOSE 8080

# Run as non-root
USER nonroot:nonroot

ENTRYPOINT ["/app/server"]
