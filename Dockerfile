# Stage 1: Build Frontend Assets
FROM node:20-alpine AS fe-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 2: Build Go Backend Binary
FROM golang:1.21-alpine AS be-builder
WORKDIR /app
# Copy module files and pre-fetch dependencies for caching
COPY backend/go.mod ./
RUN go mod download
# Copy source files
COPY backend/ ./
# Copy compiled static frontend assets from stage 1 into Go context
COPY --from=fe-builder /app/out ./static/out
# Compile a statically linked Go binary stripping debug symbols
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o optified-server main.go

# Stage 3: Minimal, Zero-OS Scratch Container (No package manager, no shell = zero CVEs)
FROM scratch
WORKDIR /

# Copy the statically compiled binary
COPY --from=be-builder /app/optified-server /optified-server

# Copy Root SSL/TLS Certificates (Required for outgoing HTTPS connections e.g. Resend, Google APIs)
COPY --from=be-builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

EXPOSE 3000

# Set entry point
ENTRYPOINT ["/optified-server"]
