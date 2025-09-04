---
theme: seriph
title: Introducing the Tower
seoMeta:
  ogImage: auto
---

# Introducing the Tower

Tower is a distributed key-value store based on [Pebble](https://github.com/cockroachdb/pebble), provided by Rivulet. Tower wraps Pebble to provide a convenient KV store interface.

by. [snowmerak](https://github.com/snowmerak)

---

## Why Did We Create Tower?

Tower is a core component of Rivulet, a modular real-time data processing architecture that ensures reliable data collection, stateful processing, and atomic storage in a distributed system.

It was developed to serve as a KV store and computation layer that handles state storage atomically.

---

## Why Pebble?

Pebble is a high-performance LSM-based embedded key-value store used by CockroachDB. We chose Pebble for the following reasons:

- **Performance**: Pebble offers high write and read performance, which is crucial for real-time data processing.
- **Reliability**: Pebble ensures data integrity and consistency, aligning with Rivulet's goal of reliable data processing.
- **Flexibility**: Pebble provides various configuration options, allowing it to be tuned for specific use cases.
- **Go Language Support**: Pebble is written in Go, which facilitates easy integration with Rivulet.
- **Lightweight**: As an embedded database, Pebble can be used directly within an application without a separate server.

---

## Key Features of Tower

- **High-Performance Reads/Writes**: Leverages Pebble's performance to provide fast data access.
- **Atomic Operations**: Supports atomic read/write operations through separate locks on multiple keys.
- **Rich Type Support**: Supports various data types such as String, Integer, Float, Boolean, Timestamp, Duration, UUID, Binary, BigInt, and Decimal.
- **Composite Type Support**: Supports composite data types like Lists, Maps, Sets, Time Series, and Bloom Filters.
- **Memory Efficiency**: Allows for memory setting optimization by adjusting cache and table sizes.

---

## Getting Started with Tower

### Installation

Installation is simple using the `go get` command:

```bash
go get github.com/rivulet-io/tower
```

Tower is composed of the following layers:

- **Storage Layer**: Wraps Pebble to provide basic KV store functionality.
- **DataFrame Layer**: Supports various data types and composite types.
- **Operations Layer**: Supports atomic read/write operations.

---

### Opening a Database

Tower allows you to specify various settings through the `tower.Options` struct and open a database using the `tower.NewTower` function.

```go
func main() {
    opts := &tower.Options{
        FS:           tower.InMemory(), // or tower.OnDisk()
        BytesPerSync: tower.NewSizeFromKilobytes(1),
        CacheSize:    tower.NewSizeFromMegabytes(10),
        MemTableSize: tower.NewSizeFromMegabytes(5),
    }
    
    db, err := tower.NewTower(opts)
    if err != nil {
        panic(err)
    }
    defer db.Close()
}
```

---

### Primitive Types

Primitive types are the basic data types provided by Tower.

All types use the basic binary serialization and deserialization features provided by the DataFrame layer by default.

---

#### String Type

The `String` type is one of the basic types and provides the following operations:

SetString, GetString, AppendString, PrependString, ReplaceString, ContainsString, StartsWithString, EndsWithString, LengthString, SubstringString, CompareString, EqualString, UpperString, LowerString

```go
err := db.SetString("text", "Hello")
value, _ := db.GetString("text")  // "Hello"
newValue, _ := db.AppendString("text", " World")  // "Hello World"
contains, _ := db.ContainsString("text", "World")  // true
length, _ := db.LengthString("text")  // 11
```

---

#### Integer Type

The `Integer` type is for handling integer data and provides the following operations:

SetInt, GetInt, AddInt, SubInt, MulInt, DivInt, IncInt, DecInt, ModInt, NegInt, AbsInt, AndInt, OrInt, XorInt, NotInt, ShiftLeftInt, ShiftRightInt, CompareInt, SetIntIfGreater, SetIntIfLess, ClampInt

```go
err := db.SetInt("counter", 10)
value, _ := db.GetInt("counter")  // 10
result, _ := db.AddInt("counter", 5)  // 15
result, _ = db.IncInt("counter")  // 16
cmp, _ := db.CompareInt("counter", 20)  // -1 (16 < 20)
```

---

#### Float Type

The `Float` type is for handling floating-point data and provides the following operations:

SetFloat, GetFloat, AddFloat, SubFloat, MulFloat, DivFloat, NegFloat, AbsFloat

```go
err := db.SetFloat("value", 3.14)
value, _ := db.GetFloat("value")  // 3.14
result, _ := db.AddFloat("value", 1.86)  // 5.0
result, _ = db.MulFloat("value", 2.0)  // 10.0
```

---

#### Boolean Type

The `Boolean` type is for handling boolean data and provides the following operations:

SetBool, GetBool, AndBool, OrBool, XorBool, NotBool, ToggleBool, EqualBool, SetBoolIfEqual

```go
err := db.SetBool("flag", true)
value, _ := db.GetBool("flag")  // true
result, _ := db.NotBool("flag")  // false
result, _ = db.ToggleBool("flag")  // true (toggled)
equal, _ := db.EqualBool("flag", true)  // true
```

---

#### Timestamp Type

The `Timestamp` type is for handling time data and provides the following operations:

SetTimestamp, GetTimestamp, AddDuration, SubDuration, BeforeTimestamp, AfterTimestamp

```go
now := time.Now()
err := db.SetTimestamp("event", now)
value, _ := db.GetTimestamp("event")  // now
later, _ := db.AddDuration("event", time.Hour)  // now + 1 hour
before, _ := db.BeforeTimestamp("event", now.Add(time.Minute))  // true
```

---

#### Duration Type

The `Duration` type is for handling duration data and provides the following operations:

SetDuration, GetDuration, AddDuration

```go
duration := time.Minute * 30
err := db.SetDuration("timeout", duration)
value, _ := db.GetDuration("timeout")  // 30m0s
newDuration, _ := db.AddDuration("timeout", time.Second*10)  // 30m10s
```

---

#### UUID Type

The `UUID` type is for handling UUID data and provides the following operations:

SetUUID, GetUUID, GenerateUUID, EqualUUID, CompareUUID, UUIDToString, StringToUUID

```go
id, _ := uuid.NewRandom()
err := db.SetUUID("user_id", id)
value, _ := db.GetUUID("user_id")  // id
newID, _ := db.GenerateUUID("new_id")  // generates a new UUID
equal, _ := db.EqualUUID("user_id", id)  // true
```

---

#### Binary Type

The `Binary` type is for handling binary data and provides the following operations:

SetBinary, GetBinary, AppendBinary

```go
data := []byte{0x01, 0x02, 0x03}
err := db.SetBinary("file", data)
value, _ := db.GetBinary("file")  // [1 2 3]
newData, _ := db.AppendBinary("file", []byte{0x04})  // [1 2 3 4]
```

---

#### BigInt Type

The `BigInt` type is for handling large integer data and provides the following operations:

SetBigInt, GetBigInt, AddBigInt, SubBigInt, MulBigInt, DivBigInt, ModBigInt, NegBigInt, AbsBigInt, CmpBigInt

```go
bigNum := new(big.Int).SetString("12345678901234567890", 10)
err := db.SetBigInt("large", bigNum)
value, _ := db.GetBigInt("large")  // bigNum
result, _ := db.AddBigInt("large", big.NewInt(100))  // bigNum + 100
cmp, _ := db.CmpBigInt("large", big.NewInt(1000))  // 1 (large > 1000)
```

---

#### Decimal Type

The `Decimal` type is for handling fixed-point decimal data and provides the following operations:

SetDecimal, GetDecimal, AddDecimal, SubDecimal, MulDecimal, DivDecimal, CmpDecimal, SetDecimalFromFloat, GetDecimalAsFloat

```go
err := db.SetDecimal("price", big.NewInt(1999), 2)  // 19.99
coeff, scale, _ := db.GetDecimal("price")  // 1999, 2
resultCoeff, resultScale, _ := db.AddDecimal("price", big.NewInt(550), 2)  // 2549, 2 (25.49)
cmp, _ := db.CmpDecimal("price", big.NewInt(2000), 2)  // -1 (19.99 < 20.00)
```

---

### Composite Types

#### List Type

The `List` type is for handling ordered collections of data, using primitive types for its elements, and provides the following operations:

CreateList, ListExists, ListLength, PushRight, PushLeft, PopLeft, PopRight, ListIndex, ListRange, ListSet, ListTrim, DeleteList

```go
err := db.CreateList("mylist")
exists, _ := db.ListExists("mylist")  // true
length, _ := db.ListLength("mylist")  // 0
newLength, _ := db.PushRight("mylist", tower.PrimitiveString("item1"))  // 1
newLength, _ = db.PushLeft("mylist", tower.PrimitiveString("item0"))  // 2
leftItem, _ := db.PopLeft("mylist")  // "item0"
item, _ := db.ListIndex("mylist", 0)  // "item1"
items, _ := db.ListRange("mylist", 0, -1)  // ["item1"]
err = db.ListSet("mylist", 0, tower.PrimitiveString("modified"))  // modify
err = db.ClearList("mylist")  // delete all elements
err = db.DeleteList("mylist")  // delete
```

---

#### Map Type

The `Map` type is for handling collections of key-value pairs, using primitive types for its elements, and provides the following operations:

CreateMap, MapExists, MapLength, MapSet, MapGet, MapKeys, MapValues, MapDelete, ClearMap, DeleteMap

```go
err := db.CreateMap("mymap")
exists, _ := db.MapExists("mymap")  // true
length, _ := db.MapLength("mymap")  // 0
err = db.MapSet("mymap", tower.PrimitiveString("name"), tower.PrimitiveString("John"))  // string key/value
err = db.MapSet("mymap", tower.PrimitiveString("age"), tower.PrimitiveInt(30))  // string key, integer value
err = db.MapSet("mymap", 42, tower.PrimitiveString("answer"))  // integer key, string value
name, _ := db.MapGet("mymap", tower.PrimitiveString("name"))  // "John"
deletedCount, _ := db.MapDelete("mymap", tower.PrimitiveString("age"))  // 1
err = db.ClearMap("mymap")  // delete all fields
err = db.DeleteMap("mymap")  // delete map
```

---

#### Set Type

The `Set` type is for handling collections of unique elements, using primitive types for its members, and provides the following operations:

CreateSet, SetExists, SetCardinality, SetAdd, SetRemove, SetIsMember, SetMembers, ClearSet, DeleteSet

```go
err := db.CreateSet("myset")
exists, _ := db.SetExists("myset")  // true
cardinality, _ := db.SetCardinality("myset")  // 0
newSize, _ := db.SetAdd("myset", tower.PrimitiveSet("member1"))  // 1
newSize, _ = db.SetAdd("myset", tower.PrimitiveSet("member1"))  // 1 (duplicates ignored)
newSize, _ = db.SetRemove("myset", tower.PrimitiveSet("member1"))  // 0
isMember, _ := db.SetIsMember("myset", tower.PrimitiveSet("member1"))  // false
members, _ := db.SetMembers("myset")  // []
err = db.ClearSet("myset")  // delete all members
err = db.DeleteSet("myset")  // delete set
```

---

#### Time Series Type

The `Time Series` type is for handling collections of data points over time and provides the following operations:

TimeSeriesCreate, TimeSeriesExists, TimeSeriesAdd, TimeSeriesGet, TimeSeriesRange, TimeSeriesRemove, TimeSeriesDelete

```go
err := db.TimeSeriesCreate("sensor-data")
exists, _ := db.TimeSeriesExists("sensor-data")  // true
now := time.Now()
err = db.TimeSeriesAdd("sensor-data", now, tower.PrimitiveFloat(23.5))  // add temperature data
err = db.TimeSeriesAdd("sensor-data", now.Add(time.Minute), tower.PrimitiveInt(85))  // add humidity data
temperature, _ := db.TimeSeriesGet("sensor-data", now)  // 23.5
humidity, _ := db.TimeSeriesGet("sensor-data", now.Add(time.Minute))  // 85
dataPoints, _ := db.TimeSeriesRange("sensor-data", now.Add(-time.Hour), now.Add(time.Hour))  // range data
for timestamp, value := range dataPoints {
    fmt.Printf("Time: %v, Value: %v\n", timestamp, value)
}
err = db.TimeSeriesRemove("sensor-data", now)  // remove a specific point
err = db.TimeSeriesDelete("sensor-data")  // delete the time series
```

---

#### Bloom Filter Type

The `Bloom Filter` type is a probabilistic data structure for efficiently testing membership in a large dataset and provides the following operations:

CreateBloomFilter, BloomFilterAdd, BloomFilterContains, BloomFilterCount, BloomFilterClear, DeleteBloomFilter

```go
err := db.CreateBloomFilter("user_cache", 3)
err = db.BloomFilterAdd("user_cache", "user123")
exists, _ := db.BloomFilterContains("user_cache", "user123")  // true
count, _ := db.BloomFilterCount("user_cache")  // 1
```

---

## Conclusion

- Tower is a high-performance, atomic KV store based on Pebble, supporting a wide range of data types and composite types. It is designed for reliable state storage and data processing in distributed systems like Rivulet.

Documentation with example code can be found in the [GitHub repository](https://github.com/rivulet-io/tower) and on [GoDoc](https://pkg.go.dev/github.com/rivulet-io/tower).

Thank you
