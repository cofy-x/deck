package provider

import (
	"fmt"
	"strings"

	"github.com/cofy-x/deck/packages/computer-use/api"
	"github.com/go-vgo/robotgo"
)

func (u *ComputerUse) TypeText(req *api.KeyboardTypeRequest) (*api.Empty, error) {
	if req.Delay > 0 {
		robotgo.Type(req.Text, req.Delay)
	} else {
		robotgo.Type(req.Text)
	}

	return new(api.Empty), nil
}

func (u *ComputerUse) PressKey(req *api.KeyboardPressRequest) (*api.Empty, error) {
	if len(req.Modifiers) > 0 {
		err := robotgo.KeyTap(req.Key, req.Modifiers)
		if err != nil {
			return nil, err
		}
	} else {
		err := robotgo.KeyTap(req.Key)
		if err != nil {
			return nil, err
		}
	}

	return new(api.Empty), nil
}

func (u *ComputerUse) PressHotkey(req *api.KeyboardHotkeyRequest) (*api.Empty, error) {
	keys := strings.Split(req.Keys, "+")
	if len(keys) < 2 {
		return nil, fmt.Errorf("invalid hotkey format")
	}

	mainKey := keys[len(keys)-1]
	modifiers := keys[:len(keys)-1]

	err := robotgo.KeyTap(mainKey, modifiers)
	if err != nil {
		return nil, err
	}

	return new(api.Empty), nil
}
