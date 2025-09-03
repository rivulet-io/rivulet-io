---
theme: seriph
title: What is the Hub from Rivulet?
seoMeta:
  ogImage: auto
---

# What is the Hub from Rivulet?

Hub is a powerful data communicator library for Go applications that embeds a NATS server and provides high-level abstractions for JetStream, Key-Value Store, and Object Store operations.

---

# Features

- **Embedded NATS Server**: Run a full NATS server in-process without external dependencies
- **JetStream Support**: Persistent messaging with streams, durable/ephemeral subscriptions
- **Key-Value Store**: Distributed key-value storage with versioning and TTL support
- **Object Store**: Large object storage with metadata support
- **Volatile Messaging**: Standard NATS publish/subscribe and request-reply patterns
- **Clustering**: Built-in support for NATS clustering
- **Size Utilities**: Convenient size handling with human-readable formats

---

# Installation

```bash
go get github.com/snowmerak/hub
```

---

# Quick Start

## Basic Node (Single Server)

```go
package main

import (
    "fmt"
    "time"

    "github.com/rivulet-io/hub"
)

func main() {
    // Create basic node options (recommended)
    opts, err := hub.DefaultNodeOptions()
    if err != nil {
        panic(err)
    }

    // Create and start hub
    h, err := hub.NewHub(opts)
    if err != nil {
        panic(err)
    }
    defer h.Shutdown()

    // Volatile messaging example
    cancel, err := h.SubscribeVolatileViaFanout("greetings", func(subject string, msg []byte) ([]byte, bool) {
        fmt.Printf("Received: %s\n", string(msg))
        return []byte("Hello back!"), true
    }, func(err error) {
        fmt.Printf("Error: %v", err)
    })
    if err != nil {
        panic(err)
    }
    defer cancel()

    // Publish message
    err = h.PublishVolatile("greetings", []byte("Hello, Hub!"))
    if err != nil {
        panic(err)
    }

    time.Sleep(time.Second)
}
```

---

## Edge Node (Central Hub Connection)

```go
package main

import (
    "fmt"
    "net/url"
    "time"

    "github.com/rivulet-io/hub"
)

func main() {
    // Create edge node options
    opts, err := hub.DefaultEdgeOptions()
    if err != nil {
        panic(err)
    }

    // Configure connection to central hub
    hubURL, _ := url.Parse("nats://central-hub:7422")
    opts.LeafNodeRoutes = []*url.URL{hubURL}

    // Create edge node
    h, err := hub.NewHub(opts)
    if err != nil {
        panic(err)
    }
    defer h.Shutdown()

    // Send message to central hub
    err = h.PublishVolatile("sensor.data", []byte("Temperature: 25°C"))
    if err != nil {
        panic(err)
    }

    time.Sleep(time.Second)
}
```

---

## Gateway Node (Network Connection)

```go
package main

import (
    "fmt"
    "net/url"
    "time"

    "github.com/rivulet-io/hub"
)

func main() {
    // Create gateway node options
    opts, err := hub.DefaultGatewayOptions()
    if err != nil {
        panic(err)
    }

    // Configure connection to other network gateways
    remoteGateway, _ := url.Parse("nats://remote-gateway:7222")
    opts.GatewayRoutes = []struct {
        Name string
        URL  *url.URL
    }{
        {Name: "remote-network", URL: remoteGateway},
    }

    // Create gateway node
    h, err := hub.NewHub(opts)
    if err != nil {
        panic(err)
    }
    defer h.Shutdown()

    // Send cross-network message
    err = h.PublishVolatile("global.announcement", []byte("System maintenance scheduled"))
    if err != nil {
        panic(err)
    }

    time.Sleep(time.Second)
}
```

---

# Usage Examples

## 1. Simple Publish/Subscribe (Basic Messaging)

The most basic messaging pattern where a publisher sends messages and subscribers receive them.

```go
// Subscriber
cancel, err := h.SubscribeVolatileViaFanout("news.updates", func(subject string, msg []byte) ([]byte, bool) {
    fmt.Printf("Received news: %s\n", string(msg))
    return nil, false // no response
}, func(err error) {
    log.Printf("Subscription error: %v", err)
})

// Publisher
err = h.PublishVolatile("news.updates", []byte("New news update!"))
```

**Use cases**: Real-time notifications, log collection, event broadcasting

---

## 2. QueueSub (Queue-based Subscription)

A pattern where only one subscriber among multiple subscribers processes each message.

```go
// Multiple workers join the same queue group
for i := 0; i < 3; i++ {
    workerID := fmt.Sprintf("worker-%d", i)
    cancel, err := h.SubscribeVolatileViaQueue("tasks", "task-queue", func(subject string, msg []byte) ([]byte, bool) {
        fmt.Printf("Worker %s processing task: %s\n", workerID, string(msg))
        return nil, false
    }, func(err error) {
        log.Printf("Worker %s error: %v", workerID, err)
    })
    defer cancel()
}

// Publish task - only one worker will process it
err = h.PublishVolatile("tasks", []byte("Data processing task"))
```

**Use cases**: Task distribution, load balancing, microservice task processing

---

## 3. Request/Reply (Request-Response)

A synchronous request-response pattern.

```go
// Responder
cancel, err := h.SubscribeVolatileViaFanout("calculator.add", func(subject string, msg []byte) ([]byte, bool) {
    // Process request like "2+3" and calculate result
    result := calculate(string(msg))
    return []byte(fmt.Sprintf("Result: %d", result)), true // return response
}, func(err error) {
    log.Printf("Calculator error: %v", err)
})

// Requester
response, err := h.RequestVolatile("calculator.add", []byte("2+3"), 5*time.Second)
if err != nil {
    log.Printf("Request failed: %v", err)
} else {
    fmt.Printf("Calculation result: %s\n", string(response))
}
```

**Use cases**: RPC calls, inter-service communication, data queries

---

## 4. JetStream Persistent Messaging

Messages are stored on disk and persist even after system restarts.

```go
// Create stream
config := &hub.PersistentConfig{
    Description: "Order processing stream",
    Subjects:    []string{"orders.>"},
    Retention:   0, // Limits policy
    MaxMsgs:     100000,
    MaxAge:      24 * time.Hour,
}
err := h.CreateOrUpdatePersistent(config)

// Create durable subscription
cancel, err := h.SubscribePersistentViaDurable("order-processor", "orders.new", func(subject string, msg []byte) ([]byte, bool, bool) {
    fmt.Printf("Processing order: %s\n", string(msg))
    return nil, false, true // send ACK
}, func(err error) {
    log.Printf("Order processing error: %v", err)
})

// Publish message
err = h.PublishPersistent("orders.new", []byte("New order: Product A x 2"))
```

**Use cases**: Order systems, event sourcing, audit logs

---

## 5. JetStream QueueSub (Persistent Queue)

Combines JetStream's persistent storage with queue-based processing.

```go
// Create stream (Limits policy allows multiple consumers)
config := &hub.PersistentConfig{
    Description: "Task queue stream",
    Subjects:    []string{"work.>"},
    Retention:   0, // Limits policy - allows multiple durable names
    MaxMsgs:     10000,
}
err := h.CreateOrUpdatePersistent(config)

// Multiple workers subscribe to same subject (each with different durable name)
workerNames := []string{"worker-1", "worker-2", "worker-3"}
for _, workerName := range workerNames {
    cancel, err := h.SubscribePersistentViaDurable(workerName, "work.tasks", func(subject string, msg []byte) ([]byte, bool, bool) {
        fmt.Printf("Worker %s processing: %s\n", workerName, string(msg))
        return nil, false, true // ACK
    }, func(err error) {
        log.Printf("Worker %s error: %v", workerName, err)
    })
    defer cancel()
}

// Publish task - only one worker will process it
err = h.PublishPersistent("work.tasks", []byte("Important batch job"))
```

**Use cases**: Batch processing, email sending, file conversion

---

## 7. Key-Value Store (Configuration and Cache)

```go
// Create user settings store
kvConfig := hub.KeyValueStoreConfig{
    Bucket:       "user-settings",
    Description:  "User personal settings",
    MaxValueSize: hub.NewSizeFromKilobytes(64),
    TTL:          30 * 24 * time.Hour, // 30 days
}
err := h.CreateOrUpdateKeyValueStore(kvConfig)

// Store and retrieve settings
settings := `{"theme": "dark", "language": "ko"}`
_, err = h.PutToKeyValueStore("user-settings", "user123", []byte(settings))

data, revision, err := h.GetFromKeyValueStore("user-settings", "user123")
```

**Use cases**: User settings, application configuration, cached data

---

## 8. Distributed Locking (Concurrency Control)

```go
// Create lock bucket
lockConfig := hub.KeyValueStoreConfig{
    Bucket:       "distributed-locks",
    Description:  "Distributed lock coordination",
    MaxValueSize: hub.NewSizeFromBytes(64),
    TTL:          30 * time.Second, // Auto-expiry for safety
    Replicas:     1,
}
err := h.CreateOrUpdateKeyValueStore(lockConfig)

// Try to acquire lock (non-blocking)
cancel, err := h.TryLock("distributed-locks", "resource-123")
if err != nil {
    log.Printf("Failed to acquire lock: %v", err)
    return
}
defer cancel() // Always release lock

// Critical section - only one process can execute this
fmt.Println("Processing exclusive resource...")
time.Sleep(5 * time.Second)

// Lock is automatically released when cancel() is called
```

**Use cases**: Database migrations, singleton tasks, resource coordination, leader election

---

## 9. Object Store (Large Files)

```go
// Create document store
objConfig := hub.ObjectStoreConfig{
    Bucket:      "user-documents",
    Description: "User uploaded documents",
    MaxBytes:    hub.NewSizeFromGigabytes(100),
    TTL:         365 * 24 * time.Hour, // 1 year
}
err := h.CreateObjectStore(objConfig)

// Upload file
fileData := readFile("report.pdf")
metadata := map[string]string{
    "filename":    "Monthly Report.pdf",
    "contentType": "application/pdf",
    "uploadedBy":  "user123",
}
err = h.PutToObjectStore("user-documents", "report-2024-01", fileData, metadata)

// Download file
data, err := h.GetFromObjectStore("user-documents", "report-2024-01")
```

**Use cases**: File uploads, image storage, document management

---

# Configuration

Hub provides three main configuration options tailored for different deployment scenarios:

## 1. DefaultNodeOptions() - Basic Node Configuration

The most complete configuration with full functionality, optimized for single-node operations.

```go
// Create basic node (recommended)
opts, err := hub.DefaultNodeOptions()
if err != nil {
    panic(err)
}

h, err := hub.NewHub(opts)
```

**Key Features:**
- **Ports**: Client (4222), Cluster (6222), Leaf Node (7422)
- **JetStream**: Enabled (512MB memory, 10GB storage)
- **Clustering**: Supported (pool size 64, ping interval 2 minutes)
- **Data Directory**: `./data` (auto-created)
- **Logging**: File rotation (10MB, max 3 files)
- **ID Management**: Auto-generated and file-based recovery

**Use Cases:** Single server applications, development/test environments, standalone services

---

## 2. DefaultGatewayOptions() - Gateway Node Configuration

```go
// Create gateway node
opts, err := hub.DefaultGatewayOptions()
if err != nil {
    panic(err)
}

// Add gateway routes
gatewayURL, _ := url.Parse("nats://remote-gateway:7222")
opts.GatewayRoutes = []struct {
    Name string
    URL  *url.URL
}{
    {Name: "remote-net", URL: gatewayURL},
}

h, err := hub.NewHub(opts)
```

**Key Features:**
- **Base Node Features** + Gateway functionality
- **Gateway Port**: 7222
- **Cross-Network Routing**: Supported
- **Message Forwarding**: Automatic
- **Network Isolation**: Bridge role

**Use Cases:** Multi-network connections, inter-datacenter communication, distributed system gateways

---

## 3. DefaultEdgeOptions() - Edge Node Configuration

```go
// Create edge node
opts, err := hub.DefaultEdgeOptions()
if err != nil {
    panic(err)
}

// Configure central hub connection
hubURL, _ := url.Parse("nats://central-hub:7422")
opts.LeafNodeRoutes = []*url.URL{hubURL}

h, err := hub.NewHub(opts)
```

**Key Features:**
- **JetStream**: Disabled (lightweight)
- **Leaf Node Connection**: Auto-connects to central hub
- **Message Delegation**: Persistent storage delegated to hub
- **Resource Optimization**: Memory/storage optimized
- **Fast Startup**: Minimal configuration for quick deployment

**Use Cases:** IoT devices, edge computing nodes, lightweight clients, distributed sensor networks

---

# Deployment Architecture Patterns

## 1. Single Node Architecture

```go
// Simplest configuration
opts, err := hub.DefaultNodeOptions()
h, err := hub.NewHub(opts)
```

**Pros**: Simple setup, fast startup
**Cons**: Single point of failure, limited scalability

## 2. Cluster Architecture

```go
// Node 1
opts1, err := hub.DefaultNodeOptions()
opts1.Routes = []*url.URL{} // Other node URLs

// Node 2
opts2, err := hub.DefaultNodeOptions()
opts2.Routes = []*url.URL{{Host: "node1:6222"}}
```

**Pros**: High availability, load balancing
**Cons**: Complex configuration, network overhead

---

## 3. Gateway Architecture

```go
// Gateway node
gatewayOpts, err := hub.DefaultGatewayOptions()

// Network A
netAOpts, err := hub.DefaultNodeOptions()

// Network B
netBOpts, err := hub.DefaultNodeOptions()
```

**Pros**: Network isolation, enhanced security
**Cons**: Additional hop causing latency

## 4. Edge Architecture

```go
// Central hub
hubOpts, err := hub.DefaultNodeOptions()

// Edge nodes
for i := 0; i < 10; i++ {
    edgeOpts, err := hub.DefaultEdgeOptions()
    edgeOpts.LeafNodeRoutes = []*url.URL{{Host: "central-hub:7422"}}
}
```

**Pros**: Efficient resource usage, easy scaling
**Cons**: Hub dependency, centralization

---

# API Reference

## Core Methods

- `NewHub(opts *Options) (*Hub, error)` - Create and start a new hub
- `Shutdown()` - Gracefully shutdown the hub

## Volatile Messaging

- `SubscribeVolatileViaFanout(subject, handler, errHandler)` - Fanout subscription
- `SubscribeVolatileViaQueue(subject, queue, handler, errHandler)` - Queue subscription
- `PublishVolatile(subject, msg)` - Publish message
- `RequestVolatile(subject, msg, timeout)` - Publish request and wait for response

## JetStream

- `CreateOrUpdatePersistent(config)` - Create/update persistent stream
- `SubscribePersistentViaDurable(id, subject, handler, errHandler)` - Durable consumer
- `SubscribePersistentViaEphemeral(subject, handler, errHandler)` - Ephemeral consumer
- `PublishPersistent(subject, msg)` - Publish message to persistent stream

## Key-Value Store

- `CreateOrUpdateKeyValueStore(config)` - Create/update KV store
- `GetFromKeyValueStore(bucket, key)` - Retrieve value by key
- `PutToKeyValueStore(bucket, key, value)` - Store key-value pair

---

# Requirements

- Go 1.25.0 or later
- Linux, macOS, or Windows

## Dependencies

- [NATS Server](https://github.com/nats-io/nats-server) - Embedded NATS server
- [NATS Go Client](https://github.com/nats-io/nats.go) - NATS client library
- [Randflake](https://gosuda.org/randflake) - ID generation

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
