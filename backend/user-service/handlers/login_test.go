package handlers

import "testing"

// Which logins are looked up by email; the rest go by username
func TestEmailPattern(t *testing.T) {
	cases := map[string]bool{
		"tung@gmail.com":        true,
		"Tung.Vuong@Example.vn": true,
		"a+b@sub.domain.co":     true,
		"tung":                  false,
		"tung.vuong":            false,
		"tung@":                 false,
		"@gmail.com":            false,
		"tung@gmail":            false,
		"tung vuong@gmail.com":  false,
		"tung@@gmail.com":       false,
	}
	for login, want := range cases {
		if got := emailPattern.MatchString(login); got != want {
			t.Errorf("emailPattern.MatchString(%q) = %t, want %t", login, got, want)
		}
	}
}
