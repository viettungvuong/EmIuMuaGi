package main

import "syscall"

// Its own process group, so stopping it also stops what it started; and if the
// gateway dies without cleaning up (killed outright), Linux stops it too, so it
// doesn't hold its port and push the next copy onto another one
func childProcAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{Setpgid: true, Pdeathsig: syscall.SIGTERM}
}
