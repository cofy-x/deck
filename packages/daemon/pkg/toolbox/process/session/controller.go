package session

type SessionController struct {
	configDir string
}

func NewSessionController(configDir, workDir string) *SessionController {
	return &SessionController{
		configDir: configDir,
	}
}
