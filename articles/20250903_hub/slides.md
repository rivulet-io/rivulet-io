---
theme: seriph
title: What is the Hub from Rivulet?
seoMeta:
  ogImage: auto
---

# What is the Hub from Rivulet?

Hub is a message broker embedded in Go language apps based on NATS (https://nats.io/).

by. [snowmerak](https://github.com/snowmerak)

---

## Why did we make it?

I envisioned an environment where the app itself could act as a message broker while planning the Rivulet project and several Go-based apps. 그리고 이미 메시지 브로커로써 꽤 유명한 NATS를 접목하게 되었습니다.

- NATS 자체가 Go로 구현되어 있기에 쉽게 Go에 임베딩할 수 있습니다.
- In-Process 커넥션을 만들 수 있어서 메시지 전달이 효율적으로 수행됩니다.
- 무엇보다 NATS는 매우 가볍고 빠르며, 클러스터링을 비롯한 다양한 기능을 제공합니다.

---

## NATS is not just a simple message queue

하지만 NATS는 단순한 메시지 큐 기능을 수행하기는 하지만, Jetstream을 시작으로 다음과 같은 다양한 기능을 제공합니다.

- Jetstream: 영속적 메시지 저장 및 소비자 관리
- KV Store: 분산 및 atomic한 키-값 저장소
- Object Store: 분산 오브젝트 저장소

이러한 기능들은 NATS가 단순한 메시지 큐 이상의 카프카와 같은 메시지 브로커, 분산 KV 저장소, 분산 오브젝트 저장소로써의 역할을 수행할 수 있게 합니다.

---

## Hub is NATS embedded in your app

Hub는 NATS의 서버 및 In Process 클라이언트를 쉽게 사용할 수 있도록 래핑한 기능을 제공합니다. 설치는 평범하게 `go get`으로 설치할 수 있습니다.

```shell
# Install Hub
go get github.com/rivulet-io/hub
```

Hub에는 총 3가지 주요 노드가 있습니다.

- Node: NATS 클러스터에 참여하는 일반적인 노드
- Gateway: NATS 수퍼 클러스터의 게이트웨이 노드
- Edge: NATS 클러스터 외부에 존재하는 Leaf 노드

---

Hub를 사용하기 위한 단일 노드의 생성은 다음과 같이 매우 간단합니다.

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

아래 코드는 Gateway 노드를 생성하는 예시입니다. Gateway 노드는 하나의 NATS 클러스터와 다른 NATS 클러스터와의 연결을 담당합니다.

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

Edge 노드는 NATS 클러스터 외부에 존재하는 Leaf 노드입니다. Edge 노드는 하나의 NATS 클러스터와 연결됩니다.

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

Hub는 In-Process NATS 클라이언트를 제공합니다. 이를 통해 애플리케이션 내부에서 메시지를 주고받을 수 있습니다.

이는 Leaf 노드와 엮이며 매우 효율적인 메시지 전달을 가능하게 합니다.

예를 들어, 채팅 앱을 만든다고 가정해봅시다.

- 하나의 서버에 여러 사용자가 접속합니다.
- 모든 사용자가 하나의 채널을 NATS 클라이언트로 구독합니다.
- 모든 사용자가 메시지를 받기 위해 NATS 서버가 하나의 클라이언트에게 사용자 수만큼 같은 메시지를 전송합니다.

하지만 NATS 클러스터에 채팅 서버가 Leaf 노드로 연결되어 있다면, NATS 서버는 하나의 메시지만 Leaf 노드에 전송하고, Leaf 노드는 내부적으로 모든 사용자에게 메시지를 전달합니다. 실제 장비 간의 네트워크 트래픽은 이전과 달리 하나 분량만 발생하게 됩니다.

---

## Hub provides easy access to NATS features

Hub는 NATS의 다양한 기능에 쉽게 접근할 수 있도록 인터페이스를 제공합니다. 다음으로 간단한 예시를 보여드리도록 하겠습니다.

---

### Core NATS Fanout

다음 코드는 휘발성 메시지를 퍼블리시하고, 해당 메시지를 수신하는 예시입니다.  
`SubscribeVolatileViaFanout` 메서드는 퍼블리시된 메시지를 수신하는 콜백 함수를 등록합니다. 이 메서드는 구독 중인 모든 구독자가 메시지를 수신합니다.

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

> 이 기능은 휘발생 이벤트 발행 및 알림 전송에 유용합니다.

---

### Core NATS Queue Subscription

다음 코드는 큐 구독을 통해 메시지를 수신하는 예시입니다.  
`SubscribeVolatileViaQueue` 메서드는 퍼블리시된 메시지를 수신하는 콜백 함수를 등록합니다. 첫번째 패러미터에 큐 그룹 이름을 지정합니다. 동일한 큐 그룹에 속한 여러 워커가 존재할 경우, 퍼블리시된 메시지는 해당 워커들 중 하나에게만 전달됩니다.

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

> 이 기능은 작업 분배 및 로드 밸런싱에 유용합니다.

---

### Core NATS Request-Reply Pattern

다음 코드는 요청-응답 패턴을 구현하는 예시입니다.
`SubscribeVolatileViaQueue` 메서드는 퍼블리시된 메시지를 수신하는 콜백 함수를 등록합니다. 퍼블리셔는 응답을 기다릴 수 있으며, 콜백 함수에서 응답 및 `true`를 반환하면 퍼블리셔에게 응답이 전송됩니다.

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

> 이 기능은 RPC 스타일의 통신에 유용합니다.

---

### JetStream Persistent Messaging

다음 코드는 영속적 메시지 스트림을 생성하고, 해당 스트림에 메시지를 퍼블리시하며, 영속적 구독을 통해 메시지를 수신하는 예시입니다.

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

> 이 기능은 이벤트 소싱, audit log 전송 등에 유용합니다.

---

### JetStream Persistent Queue Subscription

다음 코드는 영속적 큐 구독을 통해 메시지를 수신하는 예시입니다.

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

> 이 기능은 작업 큐, 백그라운드 작업 처리 등에 유용합니다.

큐 구독을 사용할 때는 스트림의 Retention 정책에 주의해야 합니다. WorkQueue 정책은 오직 하나의 내구성 있는 구독자만 허용하는 반면, Limits 정책은 여러 구독자가 존재할 수 있습니다.

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

> 추가적인 정보는 [Hub Readme](https://github.com/rivulet-io/hub#51-advanced-persistent-queuesub-patterns)를 참고하세요.

---

### JetStream Pull Message Consumption

JetStream의 Pull 구독을 통해 메시지를 소비하는 예시입니다. Pull 구독은 클라이언트가 직접 메시지를 요청하는 방식으로, 대량의 메시지를 효율적으로 처리할 수 있습니다.

Hub는 아래와 같은 Pull 옵션을 제공합니다.

```go
pullOpts := hub.PullOptions{
    Batch:    20,                    // Fetch 20 messages at once
    MaxWait:  5 * time.Second,       // Wait up to 5 seconds for messages
    Interval: 100 * time.Millisecond, // Poll every 100ms
}
```

그리고 스트림을 생성합니다.

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

아래 코드는 영속적인 Pull 구독을 통해 메시지를 소비하는 예시입니다.  
해당 pull 방식은 클라이언트가 재시작 되어도 Durable 이름을 통해 이전 상태를 복구할 수 있습니다.

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

또한 Push 모델과 마찬가지로 Pull 구독에서도 임시 이름을 사용할 수 있습니다.

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

추가적인 패턴은 [Hub Readme](https://github.com/rivulet-io/hub#advanced-pull-patterns)를 참고하세요.

---

### KV Store

Hub는 또한 NATS JetStream의 KV Store 기능을 쉽게 사용할 수 있도록 인터페이스를 제공합니다. 아래 코드는 버킷을 생성하고, 키-값 쌍을 저장 및 조회하는 예시입니다.

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

> 이 기능은 설정 저장, 세션 관리 등에 유용합니다.

---

### Distributed Lock

Hub는 분산 락 기능을 제공합니다. 이를 통해 여러 인스턴스 간에 자원 접근을 조율할 수 있습니다. 이는 기본적으로 KV Store의 낙관적 락을 기반으로 동작합니다.

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

기능 마지막으로 Hub는 NATS JetStream의 Object Store 기능을 쉽게 사용할 수 있도록 인터페이스를 제공합니다. 아래 코드는 버킷을 생성하고, 오브젝트를 저장 및 조회하는 예시입니다.

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

> 이 기능은 파일 저장, 미디어 관리 등에 유용합니다.

다만 Object Store는 NATS 특성 상 좋은 성능을 내는 것에는 무리가 있으므로 대용량 파일 저장소로 사용하기보다는 메타데이터와 함께 작은 크기의 파일을 저장하는 용도로 사용하는 것을 권장합니다.

대용량 파일 저장소로 사용하기 위해서는 S3, MinIO와 같은 오브젝트 스토리지 솔루션을 사용하는 것이 좋습니다.

---

## Simple Architecture Examples with Hub

다음으로 Hub를 활용한 간단한 아키텍처 구성 옵션을 살펴보도록 하겠습니다.

### Single Instance

단일 인스턴스 환경에서 Hub는 애플리케이션 내부에 임베딩되어 메시지 브로커 역할을 수행합니다. 이 경우, 애플리케이션은 Hub를 통해 내부적으로 메시지를 주고받으며, 외부와의 통신은 필요하지 않습니다.

```go
// Simplest configuration
opts, err := hub.DefaultNodeOptions()
h, err := hub.NewHub(opts)
```

> 이 구성은 소규모 애플리케이션이나 개발 환경에 적합합니다.

---

### Clustered Instances

여러 인스턴스가 존재하는 환경에서는 Hub를 클러스터 모드로 구성할 수 있습니다. 각 인스턴스는 Hub 노드로 동작하며, 서로 메시지를 주고받을 수 있습니다. 즉, 각 인스턴스는 그 자체로 클러스터링에 참여하게 됩니다.

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

> 이 구성은 고가용성과 확장성이 필요한 애플리케이션에 적합합니다.

---

### Multi-Cluster with Gateway

여러 클러스터가 존재하는 환경에서는 Hub를 게이트웨이 노드로 구성할 수 있습니다. 각 클러스터는 자체적인 Hub 클러스터를 형성하며, 게이트웨이 노드는 서로 다른 클러스터 간의 메시지 전달을 담당합니다.

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

> 이 구성은 지리적으로 분산된 애플리케이션이나 복잡한 네트워크 토폴로지에 적합합니다.

---

### Leaf Nodes for Existing NATS Clusters

NATS 클러스터나 Hub 클러스터가 존재하는 환경에서는 Hub를 Leaf 노드로 구성할 수 있습니다. Hub는 NATS 클러스터에 연결되어 메시지를 주고받으며, 애플리케이션 내부에서는 In-Process 클라이언트를 통해 효율적인 메시지 전달이 가능합니다.

```go
hubOpts, err := hub.DefaultNodeOptions()

for i := 0; i < 10; i++ {
    edgeOpts, err := hub.DefaultEdgeOptions()
    edgeOpts.LeafNodeRoutes = []*url.URL{{Host: "central-hub:7422"}}
}
```

> 이 구성은 메시지 브로커로의 성능보다 연산 성능이 중요한 애플리케이션에 적합합니다.

---

## Conclusion

Hub는 Go 애플리케이션에 쉽게 임베딩할 수 있는 강력한 메시지 브로커 솔루션입니다. NATS의 다양한 기능을 활용하여 효율적이고 강력한 메시징 시스템을 구축할 수 있습니다.

또한 메시징 시스템이 클러스터링 되기에 어떠한 형태의 애플리케이션을 만들더라도 확장성과 유연성을 손 쉽게 확보할 수 있습니다.

Hub에 대한 더 자세한 정보는 [GitHub Repository](https://github.com/rivulet-io/hub)를 참고하세요.

감사합니다.
