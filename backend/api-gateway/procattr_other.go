//go:build !linux

package main

import "syscall"

// Its own process group, so stopping it also stops what it started (macOS has
// no Pdeathsig, see procattr_linux.go)
func childProcAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{Setpgid: true}
}
