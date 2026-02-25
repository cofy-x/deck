package terminal

import (
	"strings"
	"unicode/utf8"
)

type UTF8Decoder struct {
	// buffer only needs to hold up to 3 bytes (incomplete UTF-8)
	buffer []byte
}

func NewUTF8Decoder() *UTF8Decoder {
	return &UTF8Decoder{
		// UTF8Max is 4. We only need to store at most 3 bytes between writes.
		buffer: make([]byte, 0, utf8.UTFMax),
	}
}

// Write appends new data to the internal buffer and decodes valid UTF-8 runes.
// It returns the decoded string. Any incomplete bytes are kept for the next call.
func (d *UTF8Decoder) Write(data []byte) string {
	if len(data) == 0 && len(d.buffer) == 0 {
		return ""
	}

	// 1. Combine leftover bytes with new data
	var fullData []byte
	if len(d.buffer) > 0 {
		fullData = append(d.buffer, data...)
	} else {
		fullData = data
	}

	// 2. Fast path: if the whole chunk is valid UTF-8, return it directly
	if utf8.Valid(fullData) {
		d.buffer = d.buffer[:0]
		return string(fullData)
	}

	// 3. Slow path: find the last boundary of valid UTF-8
	var builder strings.Builder
	builder.Grow(len(fullData))

	i := 0
	for i < len(fullData) {
		r, size := utf8.DecodeRune(fullData[i:])

		if r == utf8.RuneError {
			remaining := len(fullData) - i
			// If we have fewer than 4 bytes and it's a potential rune start,
			// it might be incomplete. Stop and buffer it.
			if remaining < utf8.UTFMax {
				break
			}
			// If it's truly an invalid byte, the library will return RuneError with size 1.
			// We write the replacement character and move on.
		}

		builder.WriteRune(r)
		i += size
	}

	// 4. Update buffer with the remaining bytes
	d.buffer = d.buffer[:0]
	if i < len(fullData) {
		d.buffer = append(d.buffer, fullData[i:]...)
	}

	return builder.String()
}
