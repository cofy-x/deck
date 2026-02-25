package interactive

import (
	"fmt"

	"github.com/AlecAivazis/survey/v2"
)

// SelectString prompts the user to select a string from a list.
// If only one option is available, it returns that option without prompting.
func SelectString(message string, options []string) (string, error) {
	if len(options) == 0 {
		return "", fmt.Errorf("no options available")
	}

	if len(options) == 1 {
		return options[0], nil
	}

	var selected string
	prompt := &survey.Select{
		Message: message,
		Options: options,
	}

	if err := survey.AskOne(prompt, &selected); err != nil {
		return "", err
	}

	return selected, nil
}

// Confirm prompts the user for a yes/no confirmation.
func Confirm(message string, defaultValue bool) (bool, error) {
	var result bool
	prompt := &survey.Confirm{
		Message: message,
		Default: defaultValue,
	}

	if err := survey.AskOne(prompt, &result); err != nil {
		return false, err
	}

	return result, nil
}

// Input prompts the user for text input.
func Input(message string, defaultValue string) (string, error) {
	var result string
	prompt := &survey.Input{
		Message: message,
		Default: defaultValue,
	}

	if err := survey.AskOne(prompt, &result); err != nil {
		return "", err
	}

	return result, nil
}

// MultiSelect prompts the user to select multiple items from a list.
func MultiSelect(message string, options []string) ([]string, error) {
	if len(options) == 0 {
		return nil, fmt.Errorf("no options available")
	}

	var selected []string
	prompt := &survey.MultiSelect{
		Message: message,
		Options: options,
	}

	if err := survey.AskOne(prompt, &selected); err != nil {
		return nil, err
	}

	return selected, nil
}
