//go:build !unix

package server

import "time"

func processCPU() (time.Duration, bool) { return 0, false }
