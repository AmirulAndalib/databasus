package smtp_transport

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_Send_WithTLS_DeliversOverEncryptedConnection(t *testing.T) {
	server := startFakeServer(t, fakeServerOptions{
		implicitTLSConfig: newSelfSignedTLSConfig(t),
		authMechanisms:    []string{mechanismPlain},
	})

	err := Send(t.Context(), server.getConnection(SecurityTLS), newTestMessage(t))
	require.NoError(t, err)

	server.waitForSessionEnd(t)
	assert.Len(t, server.getMessages(), 1)
	assert.Equal(t, "EHLO backup.example.com", server.getCommands()[0])
}

func Test_Send_WithStartTLS_UpgradesBeforeAnyOtherCommand(t *testing.T) {
	server := startFakeServer(t, fakeServerOptions{
		startTLSConfig: newSelfSignedTLSConfig(t),
		authMechanisms: []string{mechanismPlain},
	})

	err := Send(t.Context(), server.getConnection(SecurityStartTLS), newTestMessage(t))
	require.NoError(t, err)

	server.waitForSessionEnd(t)
	assert.Equal(
		t,
		[]string{"EHLO", "STARTTLS", "EHLO", "AUTH", "MAIL", "RCPT", "DATA", "QUIT"},
		server.getCommandVerbs(),
	)
	assert.Equal(t, "EHLO backup.example.com", server.getCommands()[2])
	assert.Len(t, server.getMessages(), 1)
}

func Test_Send_WithStartTLSWhenServerDoesNotOfferIt_FailsWithNothingSentAfterGreeting(t *testing.T) {
	server := startFakeServer(t, fakeServerOptions{
		authMechanisms: []string{mechanismPlain, mechanismLogin},
	})

	err := Send(t.Context(), server.getConnection(SecurityStartTLS), newTestMessage(t))
	require.ErrorIs(t, err, ErrStartTLSNotOffered)

	server.waitForSessionEnd(t)
	assert.Equal(t, []string{"EHLO backup.example.com"}, server.getCommands())
	assert.Empty(t, server.getMessages())
}

func Test_Send_WithNone_NeverUpgradesAndAuthenticates(t *testing.T) {
	server := startFakeServer(t, fakeServerOptions{
		startTLSConfig: newSelfSignedTLSConfig(t),
		authMechanisms: []string{mechanismPlain},
	})

	err := Send(t.Context(), server.getConnection(SecurityNone), newTestMessage(t))
	require.NoError(t, err)

	server.waitForSessionEnd(t)
	assert.Equal(t, []string{"EHLO", "AUTH", "MAIL", "RCPT", "DATA", "QUIT"}, server.getCommandVerbs())
	assert.Len(t, server.getMessages(), 1)
}

func Test_Send_WithUntrustedCertificate_FailsUnlessVerificationIsOff(t *testing.T) {
	testCases := []struct {
		name     string
		security Security
		options  fakeServerOptions
	}{
		{"tls", SecurityTLS, fakeServerOptions{implicitTLSConfig: newSelfSignedTLSConfig(t)}},
		{"starttls", SecurityStartTLS, fakeServerOptions{startTLSConfig: newSelfSignedTLSConfig(t)}},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			testCase.options.authMechanisms = []string{mechanismPlain}
			server := startFakeServer(t, testCase.options)

			verifyingConnection := server.getConnection(testCase.security)
			verifyingConnection.IsInsecureSkipVerify = false

			err := Send(t.Context(), verifyingConnection, newTestMessage(t))
			require.Error(t, err)
			assert.Contains(t, err.Error(), "certificate")

			server.waitForSessionEnd(t)
			assert.NotContains(t, server.getCommandVerbs(), "AUTH")

			err = Send(t.Context(), server.getConnection(testCase.security), newTestMessage(t))
			require.NoError(t, err)
		})
	}
}

func Test_Send_WhenServerGoesSilentAfterGreeting_FailsWithTimeoutWithinDeadline(t *testing.T) {
	server := startFakeServer(t, fakeServerOptions{isSilentAfterGreeting: true})

	callerCtx, cancel := context.WithTimeout(t.Context(), 300*time.Millisecond)
	defer cancel()

	startedAt := time.Now().UTC()
	err := Send(callerCtx, server.getConnection(SecurityNone), newTestMessage(t))

	require.ErrorIs(t, err, ErrSessionTimeout)
	assert.Less(t, time.Since(startedAt), 2*time.Second)
}

func Test_Send_WithoutGreetingName_GreetsWithFallbackName(t *testing.T) {
	server := startFakeServer(t, fakeServerOptions{authMechanisms: []string{mechanismPlain}})

	connection := server.getConnection(SecurityNone)
	connection.HeloName = ""

	err := Send(t.Context(), connection, newTestMessage(t))
	require.NoError(t, err)

	server.waitForSessionEnd(t)
	assert.Equal(t, "EHLO "+fallbackHeloName, server.getCommands()[0])
}

func Test_Send_WithUnknownSecurity_Fails(t *testing.T) {
	err := Send(t.Context(), Connection{Host: "127.0.0.1", Port: 25, Security: "ssl"}, newTestMessage(t))

	require.ErrorIs(t, err, ErrUnknownSecurity)
}

func newTestMessage(t *testing.T) Message {
	t.Helper()

	sender, err := ParseSender("noreply@example.com")
	require.NoError(t, err)

	return Message{
		Sender:    sender,
		Recipient: "admin@example.com",
		Subject:   "Test",
		HTMLBody:  "<p>Hello</p>",
	}
}
