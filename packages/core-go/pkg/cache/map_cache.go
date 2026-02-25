package cache

import (
	"context"
	"errors"
	"time"

	cmap "github.com/orcaman/concurrent-map/v2"
)

type item[T any] struct {
	value     T
	expiresAt time.Time
}

func (i item[T]) IsExpired() bool {
	return !i.expiresAt.IsZero() && time.Now().After(i.expiresAt)
}

type MapCache[T any] struct {
	cacheMap cmap.ConcurrentMap[string, item[T]]
}

func (c *MapCache[T]) Set(ctx context.Context, key string, value T, expiration time.Duration) error {
	var exp time.Time
	if expiration > 0 {
		exp = time.Now().Add(expiration)
	}

	c.cacheMap.Set(key, item[T]{
		value:     value,
		expiresAt: exp,
	})
	return nil
}
func (c *MapCache[T]) Has(ctx context.Context, key string) (bool, error) {
	val, ok := c.cacheMap.Get(key)
	if !ok {
		return false, nil
	}

	if val.IsExpired() {
		c.cacheMap.Remove(key)
		return false, nil
	}

	return true, nil
}

func (c *MapCache[T]) Get(ctx context.Context, key string) (*T, error) {
	val, ok := c.cacheMap.Get(key)
	if !ok {
		return nil, errors.New("key not found")
	}

	if val.IsExpired() {
		c.cacheMap.Remove(key)
		return nil, errors.New("key not found")
	}

	return &val.value, nil
}

func (c *MapCache[T]) Delete(ctx context.Context, key string) error {
	c.cacheMap.Remove(key)
	return nil
}

func (c *MapCache[T]) gc(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for range ticker.C {
		for item := range c.cacheMap.IterBuffered() {
			if item.Val.IsExpired() {
				c.cacheMap.Remove(item.Key)
			}
		}
	}
}

func NewMapCache[T any]() *MapCache[T] {
	c := &MapCache[T]{
		cacheMap: cmap.New[item[T]](),
	}
	go c.gc(1 * time.Minute)
	return c
}
