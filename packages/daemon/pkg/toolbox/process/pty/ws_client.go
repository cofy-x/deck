package pty

func (cl *wsClient) close() {
	cl.closeOnce.Do(func() {
		close(cl.send)
		_ = cl.conn.Close()
	})
}
