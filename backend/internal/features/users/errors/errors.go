package users_errors

import "errors"

var ErrInsufficientPermissionsToInviteUsers = errors.New("insufficient permissions to invite users")

var (
	// The instance could not deliver the code, so it admits nobody through
	// password sign-in while the second factor is on.
	ErrSignInCodeNotSent = errors.New(
		"could not send the sign-in code, please try again later",
	)
	ErrTooManySignInCodes = errors.New(
		"too many codes requested for this account, please try again later",
	)
	ErrSignInCodeResentTooSoon = errors.New(
		"a code was sent less than a minute ago, please wait before requesting another",
	)
	ErrPendingSignInNotUsable = errors.New(
		"this sign-in can no longer be completed, please sign in again",
	)
	ErrSignInCodeIncorrect = errors.New("the code is incorrect")
)
