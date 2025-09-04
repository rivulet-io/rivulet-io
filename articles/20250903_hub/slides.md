---
theme: seriph
title: Introducing The Hub
seoMeta:
  ogImage: auto
---

# Introducing The Hub

Hub is a message broker embedded in Go language apps based on NATS (https://nats.io/).

by. [snowmerak](https://github.com/snowmerak)

---

## Why did we make it?

I envisioned an environment where the app itself could act as a message broker while planning the Rivulet project and several Go-based apps. And so, we decided to incorporate NATS, which is already quite famous as a message broker.

- Since NATS itself is implemented in Go, it can be easily embedded into Go applications.
- It allows for creating in-process connections, enabling efficient message delivery.
- Above all, NATS is very lightweight and fast, and provides various features including clustering.

---

## NATS is not just a simple message queue

However, while NATS does perform simple message queue functions, starting with Jetstream, it provides a variety of features such as:

- Jetstream: Persistent message storage and consumer management
- KV Store: Distributed and atomic key-value store
- Object Store: Distributed object store

These features allow NATS to act as more than just a simple message queue, serving as a message broker like Kafka, a distributed KV store, and a distributed object store.

---

## Hub is NATS embedded in your app

Hub provides wrapped functionality to easily use NATS server and In-Process clients. Installation is done as usual with `go get`.

```shell
# Install Hub
go get github.com/rivulet-io/hub
```

Hub has three main types of nodes.

- Node: A regular node participating in a NATS cluster
- Gateway: A gateway node for a NATS supercluster
- Edge: A Leaf node that exists outside the NATS cluster

---

Creating a single node to use Hub is very simple, as shown below.

```go
package main

import (
    "fmt"
    "time"

    "github.com/rivulet-io/hub"
)

func main() {
    opts, err := hub.DefaultNodeOptions()
    if err != nil {
        panic(err)
    }

    h, err := hub.NewHub(opts)
    if err != nil {
        panic(err)
    }
    defer h.Shutdown()
}
```

---

The code below is an example of creating a Gateway node. A Gateway node is responsible for connecting one NATS cluster to another.

```go
package main

import (
    "fmt"
    "net/url"
    "time"

    "github.com/rivulet-io/hub"
)

func main() {
    opts, err := hub.DefaultGatewayOptions()
    if err != nil { panic(err) }

    remoteGateway, _ := url.Parse("nats://remote-gateway:7222")
    opts.GatewayRoutes = []struct {
        Name string
        URL  *url.URL
    }{
        {Name: "remote-network", URL: remoteGateway},
    }
}
```

---

An Edge node is a Leaf node that exists outside the NATS cluster. An Edge node connects to a single NATS cluster.

```go
package main

import (
    "fmt"
    "net/url"
    "time"

    "github.com/rivulet-io/hub"
)

func main() {
    opts, err := hub.DefaultEdgeOptions()
    if err != nil {
        panic(err)
    }

    hubURL, _ := url.Parse("nats://central-hub:7422")
    opts.LeafNodeRoutes = []*url.URL{hubURL}
}
```

---

## Hub provides In-Process NATS client

Hub provides an In-Process NATS client. This allows messages to be exchanged within the application.

This, combined with Leaf nodes, enables very efficient message delivery.

For example, let's say you are creating a chat app.

- Multiple users connect to a single server.
- All users subscribe to a single channel using a NATS client.
- For all users to receive a message, the NATS server sends the same message to a single client as many times as there are users.

However, if the chat server is connected to the NATS cluster as a Leaf node, the NATS server sends only one message to the Leaf node, and the Leaf node internally delivers the message to all users. The actual network traffic between devices is only for one message, unlike before.

---

## Hub provides easy access to NATS features

Hub provides an interface for easy access to the various features of NATS. I will now show you a simple example.

---

### Core NATS Fanout

The following code is an example of publishing a volatile message and receiving it.
The `SubscribeVolatileViaFanout` method registers a callback function to receive published messages. With this method, all subscribers to the subject receive the message.

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

> This feature is useful for publishing volatile events and sending notifications.

---

### Core NATS Queue Subscription

The following code is an example of receiving messages through a queue subscription.
The `SubscribeVolatileViaQueue` method registers a callback function to receive published messages. The first parameter specifies the queue group name. If there are multiple workers belonging to the same queue group, a published message is delivered to only one of those workers.

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

> This feature is useful for task distribution and load balancing.

---

### Core NATS Request-Reply Pattern

The following code is an example of implementing the request-reply pattern.
The `SubscribeVolatileViaQueue` method registers a callback function to receive published messages. The publisher can wait for a response, and if the callback function returns a response and `true`, the response is sent to the publisher.

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

> This feature is useful for RPC-style communication.

---

### JetStream Persistent Messaging

The following code is an example of creating a persistent message stream, publishing messages to that stream, and receiving messages through a persistent subscription.

```go
config := &hub.PersistentConfig{
    Description: "Order processing stream",
    Subjects:    []string{"orders.>"},
    Retention:   0, // Limits policy
    MaxMsgs:     100000,
    MaxAge:      24 * time.Hour,
}
err := h.CreateOrUpdatePersistent(config)

cancel, err := h.SubscribePersistentViaDurable("order-processor", "orders.new", func(subject string, msg []byte) ([]byte, bool, bool) {
    fmt.Printf("Processing order: %s\n", string(msg))
    return nil, false, true // send ACK
}, func(err error) {
    log.Printf("Order processing error: %v", err)
})

err = h.PublishPersistent("orders.new", []byte("New order: Product A x 2"))
```

> This feature is useful for event sourcing, sending audit logs, etc.

---

### JetStream Persistent Queue Subscription

The following code is an example of receiving messages through a persistent queue subscription.

```go
config := &hub.PersistentConfig{
    Description: "Task queue stream",
    Subjects:    []string{"work.>"},
    Retention:   0, // Limits policy - allows multiple consumers
    MaxMsgs:     10000,
}
err := h.CreateOrUpdatePersistent(config)

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

err = h.PublishPersistent("work.tasks", []byte("Important batch job"))
```

---

> This feature is useful for task queues, background job processing, etc.

When using queue subscriptions, you must pay attention to the stream's Retention policy. The WorkQueue policy allows only one durable subscriber, whereas the Limits policy allows multiple subscribers.

```go
config := &hub.PersistentConfig{
    Subjects:  []string{"work.>"},
    Retention: 2, // WorkQueue - only one durable name allowed
}

config := &hub.PersistentConfig{
    Subjects:  []string{"work.>"},
    Retention: 0, // Limits - multiple durable names allowed
}
```

| Policy      | Consumer Count     | Message Processing | Use Cases                     |
|-------------|--------------------|--------------------|-------------------------------|
| WorkQueue   | Only 1 durable name| Exactly once       | Strict deduplication          |
| Limits      | Multiple durable names | Load balancing   | Task distribution, scalability |

> For more information, please refer to the [Hub Readme](https://github.com/rivulet-io/hub#51-advanced-persistent-queuesub-patterns).

---

### JetStream Pull Message Consumption

This is an example of consuming messages via JetStream's Pull subscription. A Pull subscription is a method where the client directly requests messages, allowing for efficient processing of large volumes of messages.

Hub provides the following pull options.

```go
pullOpts := hub.PullOptions{
    Batch:    20,                    // Fetch 20 messages at once
    MaxWait:  5 * time.Second,       // Wait up to 5 seconds for messages
    Interval: 100 * time.Millisecond, // Poll every 100ms
}
```

And create the stream.

```go
config := &hub.PersistentConfig{
    Description: "Batch processing stream",
    Subjects:    []string{"batch.>"},
    Retention:   0, // Limits policy
    MaxMsgs:     10000,
}
err := h.CreateOrUpdatePersistent(config)
```

---

The code below is an example of consuming messages via a persistent Pull subscription.
This pull method allows the client to recover its previous state through the Durable name even if it restarts.

```go
cancel, err := h.PullPersistentViaDurable(
    "batch-processor",    // Durable consumer ID
    "batch.tasks",        // Subject
    pullOpts,            // Pull options
    func(subject string, msg []byte) ([]byte, bool, bool) {
        fmt.Printf("Batch processing: %s\n", string(msg))
        
        // Process message in batch context
        processBatchItem(msg)
        
        return nil, false, true // ACK
    },
    func(err error) {
        log.Printf("Pull error: %v", err)
    },
)
defer cancel()
```

---

Also, just like the Push model, you can use an ephemeral name for Pull subscriptions.

```go
// Temporary pull consumer for one-time batch jobs
cancel, err := h.PullPersistentViaEphemeral(
    "batch.cleanup",     // Subject
    pullOpts,           // Pull options
    func(subject string, msg []byte) ([]byte, bool, bool) {
        fmt.Printf("Cleanup task: %s\n", string(msg))
        return nil, false, true
    },
    errorHandler,
)
defer cancel()
```

For additional patterns, please refer to the [Hub Readme](https://github.com/rivulet-io/hub#advanced-pull-patterns).

---

### KV Store

Hub also provides an interface to easily use NATS JetStream's KV Store feature. The code below is an example of creating a bucket, and storing and retrieving key-value pairs.

```go
kvConfig := hub.KeyValueStoreConfig{
    Bucket:       "user-settings",
    Description:  "User personal settings",
    MaxValueSize: hub.NewSizeFromKilobytes(64),
    TTL:          30 * 24 * time.Hour, // 30 days
}
err := h.CreateOrUpdateKeyValueStore(kvConfig)

settings := `{"theme": "dark", "language": "ko"}`
_, err = h.PutToKeyValueStore("user-settings", "user123", []byte(settings))

data, revision, err := h.GetFromKeyValueStore("user-settings", "user123")
```

> This feature is useful for storing settings, session management, etc.

---

### Distributed Lock

Hub provides a distributed lock feature. This allows you to coordinate resource access among multiple instances. It is based on the optimistic locking of the KV Store.

```go
lockConfig := hub.KeyValueStoreConfig{
    Bucket:       "distributed-locks",
    Description:  "Distributed lock coordination",
    MaxValueSize: hub.NewSizeFromBytes(64),
    TTL:          30 * time.Second, // Auto-expiry for safety
    Replicas:     1,
}
err := h.CreateOrUpdateKeyValueStore(lockConfig)

cancel, err := h.TryLock("distributed-locks", "resource-123")
if err != nil {
    log.Printf("Failed to acquire lock: %v", err)
    return
}
defer cancel() // Always release lock

fmt.Println("Processing exclusive resource...") // Critical section
time.Sleep(5 * time.Second)
```

---

### Object Store

Finally, Hub provides an interface to easily use NATS JetStream's Object Store feature. The code below is an example of creating a bucket, and storing and retrieving objects.

```go
// Create document store
objConfig := hub.ObjectStoreConfig{
    Bucket:      "user-documents",
    Description: "User uploaded documents",
    MaxBytes:    hub.NewSizeFromGigabytes(100),
    TTL:         365 * 24 * time.Hour, // 1 year
}
err := h.CreateObjectStore(objConfig)
```

---

```go
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

> This feature is useful for file storage, media management, etc.

However, due to the nature of NATS, it is difficult for the Object Store to achieve high performance. Therefore, it is recommended to use it for storing small files with metadata rather than as a large-scale file storage solution.

For large-scale file storage, it is better to use object storage solutions like S3 or MinIO.

---

## Simple Architecture Examples with Hub

Next, let's look at some simple architecture options using Hub.

### Single Instance

In a single-instance environment, Hub is embedded within the application and acts as a message broker. In this case, the application communicates internally via Hub, and no external communication is necessary.

```go
// Simplest configuration
opts, err := hub.DefaultNodeOptions()
h, err := hub.NewHub(opts)
```

> This configuration is suitable for small-scale applications or development environments.

---

### Clustered Instances

In an environment with multiple instances, Hub can be configured in cluster mode. Each instance acts as a Hub node and can exchange messages with others. In other words, each instance itself participates in clustering.

```go
// Node 1
opts1, err := hub.DefaultNodeOptions()
opts1.Routes = []*url.URL{} // Other node URLs

// Node 2
opts2, err := hub.DefaultNodeOptions()
opts2.Routes = []*url.URL{{Host: "node1:6222"}}

// Node 3
opts3, err := hub.DefaultNodeOptions()
opts3.Routes = []*url.URL{{Host: "node1:6222"}, {Host: "node2:6222"}}
```

> This configuration is suitable for applications requiring high availability and scalability.

---

### Multi-Cluster with Gateway

In an environment with multiple clusters, Hub can be configured as a gateway node. Each cluster forms its own Hub cluster, and the gateway nodes are responsible for message delivery between different clusters.

```go
// Gateway node for Network A
gatewayForNetAOpts, err := hub.DefaultGatewayOptions()

// Gateway node for Network B
gatewayForNetBOpts, err := hub.DefaultGatewayOptions()

// Network A
netAOpts, err := hub.DefaultNodeOptions()
netAOpts.Routes = []*url.URL{{Host: "gateway-for-net-a:7222"}}

// Network B
netBOpts, err := hub.DefaultNodeOptions()
netBOpts.Routes = []*url.URL{{Host: "gateway-for-net-b:7222"}}
```

> This configuration is suitable for geographically distributed applications or complex network topologies.

---

### Leaf Nodes for Existing NATS Clusters

In an environment with an existing NATS cluster or Hub cluster, Hub can be configured as a Leaf node. Hub connects to the NATS cluster to exchange messages, and efficient message delivery is possible within the application via the In-Process client.

```go
hubOpts, err := hub.DefaultNodeOptions()

for i := 0; i < 10; i++ {
    edgeOpts, err := hub.DefaultEdgeOptions()
    edgeOpts.LeafNodeRoutes = []*url.URL{{Host: "central-hub:7422"}}
}
```

> This configuration is suitable for applications where computational performance is more critical than message broker performance.

---

## Conclusion

Hub is a powerful message broker solution that can be easily embedded into Go applications. You can build an efficient and robust messaging system by leveraging the various features of NATS.

Also, because the messaging system is clustered, you can easily secure scalability and flexibility regardless of the type of application you create.

For more detailed information about Hub, please refer to the [GitHub Repository](https://github.com/rivulet-io/hub).

Thank you.
