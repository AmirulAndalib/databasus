package smtp_transport

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_GetDefaultSecurityForPort_ReturnsTLSOnlyForPort465(t *testing.T) {
	assert.Equal(t, SecurityTLS, GetDefaultSecurityForPort(465))
	assert.Equal(t, SecurityStartTLS, GetDefaultSecurityForPort(587))
	assert.Equal(t, SecurityStartTLS, GetDefaultSecurityForPort(25))
	assert.Equal(t, SecurityStartTLS, GetDefaultSecurityForPort(2525))
}
