package util

// Use generics to create a pointer to a value
func Pointer[T any](d T) *T {
	return &d
}
