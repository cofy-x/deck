package httputil

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// ProcessAPIResponse reads and processes an HTTP response from an API call.
func ProcessAPIResponse(httpResp *http.Response, err error, target any) (any, error) {
	if err != nil {
		return nil, fmt.Errorf("API call failed: %w", err)
	}
	if httpResp == nil {
		return nil, fmt.Errorf("API call failed: empty response")
	}
	defer httpResp.Body.Close()

	bodyBytes, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if httpResp.StatusCode < http.StatusOK || httpResp.StatusCode >= http.StatusMultipleChoices {
		var apiError map[string]any
		if len(bodyBytes) > 0 && json.Unmarshal(bodyBytes, &apiError) == nil {
			return nil, fmt.Errorf("API error (%d): %v", httpResp.StatusCode, apiError)
		}
		return nil, fmt.Errorf("API error (%d): %s", httpResp.StatusCode, string(bodyBytes))
	}

	if len(bodyBytes) == 0 {
		return nil, nil
	}

	if target != nil {
		if err := json.Unmarshal(bodyBytes, target); err != nil {
			return nil, fmt.Errorf("failed to unmarshal response body into target type: %w", err)
		}
		return target, nil
	}

	var jsonResult any
	if json.Unmarshal(bodyBytes, &jsonResult) == nil {
		return jsonResult, nil
	}

	return string(bodyBytes), nil
}
