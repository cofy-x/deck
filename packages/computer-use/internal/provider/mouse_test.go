package provider

import (
	"testing"

	"github.com/cofy-x/deck/packages/computer-use/api"
)

func TestNormalizeScrollDelta(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		req       *api.MouseScrollRequest
		wantDelta int
		wantErr   bool
	}{
		{
			name:      "up_with_default_amount",
			req:       &api.MouseScrollRequest{Direction: "up"},
			wantDelta: 3,
		},
		{
			name:      "down_with_default_amount",
			req:       &api.MouseScrollRequest{Direction: "down"},
			wantDelta: -3,
		},
		{
			name:      "up_custom_amount",
			req:       &api.MouseScrollRequest{Direction: "up", Amount: 7},
			wantDelta: 7,
		},
		{
			name:      "down_custom_amount",
			req:       &api.MouseScrollRequest{Direction: "down", Amount: 7},
			wantDelta: -7,
		},
		{
			name:      "direction_case_insensitive",
			req:       &api.MouseScrollRequest{Direction: "UP", Amount: 4},
			wantDelta: 4,
		},
		{
			name:      "negative_amount_normalized",
			req:       &api.MouseScrollRequest{Direction: "down", Amount: -4},
			wantDelta: -4,
		},
		{
			name:    "nil_request",
			req:     nil,
			wantErr: true,
		},
		{
			name:    "missing_direction",
			req:     &api.MouseScrollRequest{},
			wantErr: true,
		},
		{
			name:    "invalid_direction",
			req:     &api.MouseScrollRequest{Direction: "left", Amount: 2},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := normalizeScrollDelta(tt.req)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.wantDelta {
				t.Fatalf("delta mismatch: got %d, want %d", got, tt.wantDelta)
			}
		})
	}
}
