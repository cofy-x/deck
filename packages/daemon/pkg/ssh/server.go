package ssh

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"

	"github.com/cofy-x/deck/apps/daemon/pkg/common"
	"github.com/cofy-x/deck/apps/daemon/pkg/ssh/config"
	"github.com/gliderlabs/ssh"
	"github.com/pkg/sftp"
	"golang.org/x/sys/unix"

	"github.com/cofy-x/deck/packages/core-go/pkg/log"
)

type Server struct {
	WorkDir        string
	DefaultWorkDir string
}

// genSessionID creates a short unique hex string for log traceability.
func genSessionID() string {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		return "unknown"
	}
	return hex.EncodeToString(b)
}

func (s *Server) Start() error {
	forwardedTCPHandler := &ssh.ForwardedTCPHandler{}
	unixForwardHandler := newForwardedUnixHandler()

	sshServer := ssh.Server{
		Addr: fmt.Sprintf(":%d", config.SSH_PORT),
		PublicKeyHandler: func(ctx ssh.Context, key ssh.PublicKey) bool {
			log.Debugf("Public key authentication accepted for user: %s", ctx.User())
			return true
		},
		PasswordHandler: func(ctx ssh.Context, password string) bool {
			// Specific sandbox authentication logic
			authenticated := password == "sandbox-ssh"
			if authenticated {
				log.Debugf("Password authentication succeeded for user: %s", ctx.User())
			} else {
				log.Debugf("Password authentication failed for user: %s", ctx.User())
			}
			return authenticated
		},
		Handler: func(session ssh.Session) {
			sid := genSessionID()
			log.Infof("[SSH-%s] New session from %s", sid, session.RemoteAddr())

			switch ss := session.Subsystem(); ss {
			case "":
				// Proceed to PTY/Non-PTY logic
			case "sftp":
				log.Infof("[SSH-%s] Initializing SFTP subsystem", sid)
				s.sftpHandler(session)
				return
			default:
				log.Errorf("[SSH-%s] Subsystem %s not supported", sid, ss)
				session.Exit(1)
				return
			}

			ptyReq, winCh, isPty := session.Pty()
			if session.RawCommand() == "" && isPty {
				s.handlePty(sid, session, ptyReq, winCh)
			} else {
				s.handleNonPty(sid, session)
			}
			log.Infof("[SSH-%s] Session closed", sid)
		},
		ChannelHandlers: map[string]ssh.ChannelHandler{
			"session":                        ssh.DefaultSessionHandler,
			"direct-tcpip":                   ssh.DirectTCPIPHandler,
			"direct-streamlocal@openssh.com": directStreamLocalHandler,
		},
		RequestHandlers: map[string]ssh.RequestHandler{
			"tcpip-forward":                          forwardedTCPHandler.HandleSSHRequest,
			"cancel-tcpip-forward":                   forwardedTCPHandler.HandleSSHRequest,
			"streamlocal-forward@openssh.com":        unixForwardHandler.HandleSSHRequest,
			"cancel-streamlocal-forward@openssh.com": unixForwardHandler.HandleSSHRequest,
		},
		SubsystemHandlers: map[string]ssh.SubsystemHandler{
			"sftp": s.sftpHandler,
		},
		LocalPortForwardingCallback: ssh.LocalPortForwardingCallback(func(ctx ssh.Context, dhost string, dport uint32) bool {
			return true
		}),
		ReversePortForwardingCallback: ssh.ReversePortForwardingCallback(func(ctx ssh.Context, host string, port uint32) bool {
			return true
		}),
		SessionRequestCallback: func(sess ssh.Session, requestType string) bool {
			return true
		},
	}

	log.Printf("Starting SSH server on port %d...", config.SSH_PORT)
	return sshServer.ListenAndServe()
}

func (s *Server) handlePty(sid string, session ssh.Session, ptyReq ssh.Pty, winCh <-chan ssh.Window) {
	dir := s.WorkDir
	if _, err := os.Stat(s.WorkDir); os.IsNotExist(err) {
		dir = s.DefaultWorkDir
	}

	env := []string{}
	if ssh.AgentRequested(session) {
		l, err := ssh.NewAgentListener()
		if err == nil {
			defer l.Close()
			go ssh.ForwardAgentConnections(l, session)
			env = append(env, fmt.Sprintf("SSH_AUTH_SOCK=%s", l.Addr().String()))
		}
	}

	ctx, cancel := context.WithCancel(session.Context())
	defer cancel()

	// Buffer size 1 prevents blocking during high-frequency window resizes
	sizeCh := make(chan common.TTYSize, 1)

	go func() {
		for {
			select {
			case win, ok := <-winCh:
				if !ok {
					return
				}
				select {
				case sizeCh <- common.TTYSize{Height: win.Height, Width: win.Width}:
				case <-ctx.Done():
					return
				default:
					// Drop older events to keep the session responsive
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	err := common.SpawnTTY(common.SpawnTTYOptions{
		Context:   ctx,
		SessionID: sid,
		Dir:       dir,
		StdIn:     session,
		StdOut:    session,
		Term:      ptyReq.Term,
		Env:       env,
		SizeCh:    sizeCh,
	})

	cancel() // Ensure the resize goroutine exits

	if err != nil {
		log.Debugf("[SSH-%s] PTY session ended with message: %v", sid, err)
	}
}

func (s *Server) handleNonPty(sid string, session ssh.Session) {
	ctx, cancel := context.WithCancel(session.Context())
	defer cancel()

	args := []string{}
	if len(session.Command()) > 0 {
		args = append([]string{"-c"}, session.RawCommand())
	}

	cmd := exec.Command("/bin/sh", args...)
	cmd.Env = append(os.Environ(), "DECK_SESSION_ID="+sid)

	if ssh.AgentRequested(session) {
		l, err := ssh.NewAgentListener()
		if err == nil {
			defer l.Close()
			go ssh.ForwardAgentConnections(l, session)
			cmd.Env = append(cmd.Env, fmt.Sprintf("SSH_AUTH_SOCK=%s", l.Addr().String()))
		}
	}

	cmd.Dir = s.WorkDir
	if _, err := os.Stat(s.WorkDir); os.IsNotExist(err) {
		cmd.Dir = s.DefaultWorkDir
	}

	cmd.Stdout = session
	cmd.Stderr = session.Stderr()
	stdinPipe, err := cmd.StdinPipe()
	if err != nil {
		log.Errorf("[SSH-%s] Failed to setup stdin: %v", sid, err)
		return
	}

	// Managed Stdin Copy: prevents goroutine leaks by closing pipe when done
	go func() {
		defer stdinPipe.Close()
		_, _ = io.Copy(stdinPipe, session)
	}()

	if err := cmd.Start(); err != nil {
		log.Errorf("[SSH-%s] Failed to start command: %v", sid, err)
		session.Exit(1)
		return
	}

	// Watchdog to kill process if SSH client disconnects
	go func() {
		<-ctx.Done()
		if cmd.Process != nil && cmd.ProcessState == nil {
			_ = cmd.Process.Kill()
		}
	}()

	// Signal forwarding for the non-PTY process
	sigs := make(chan ssh.Signal, 1)
	session.Signals(sigs)
	go func() {
		for sig := range sigs {
			if cmd.Process != nil {
				_ = cmd.Process.Signal(s.osSignalFrom(sig))
			}
		}
	}()

	err = cmd.Wait()
	_ = stdinPipe.Close() // Force unblock io.Copy

	if err != nil {
		errStr := err.Error()
		// Suppress errors caused by the global PID 1 reaper
		if strings.Contains(errStr, "already finished") ||
			strings.Contains(errStr, "Wait was already called") ||
			strings.Contains(errStr, "no child processes") {
			err = nil
		}
	}

	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			session.Exit(exitErr.ExitCode())
		} else {
			log.Warnf("[SSH-%s] Command wait error: %v", sid, err)
			session.Exit(1)
		}
		return
	}

	_ = session.Exit(0)
}

func (s *Server) osSignalFrom(sig ssh.Signal) os.Signal {
	switch sig {
	case ssh.SIGINT:
		return unix.SIGINT
	case ssh.SIGTERM:
		return unix.SIGTERM
	case ssh.SIGKILL:
		return unix.SIGKILL
	case ssh.SIGQUIT:
		return unix.SIGQUIT
	case ssh.SIGHUP:
		return unix.SIGHUP
	default:
		return unix.SIGKILL
	}
}

func (s *Server) sftpHandler(session ssh.Session) {
	server, err := sftp.NewServer(session, sftp.WithDebug(io.Discard))
	if err != nil {
		log.Errorf("SFTP init error: %v", err)
		return
	}
	if err := server.Serve(); err != nil && err != io.EOF {
		log.Errorf("SFTP session error: %v", err)
	}
	server.Close()
}
