package users_services

import (
	"context"
	"fmt"
	"strings"

	users_models "databasus-backend/internal/features/users/models"
)

// NoAdminsMessage is what an instance nobody has registered on answers with. It
// is a sentence rather than an empty listing because the owner running the
// command is trying to find out why they cannot sign in.
const NoAdminsMessage = "This instance has no administrator: no account has been created on it yet."

// The active state is part of the answer because a deactivated administrator
// otherwise reads as an address that should work. Nothing else is rendered: no
// password, no password hash, no token.
//
// The listing writes no audit entry. It runs from the console, where no feature
// has installed an audit writer, and it must not acquire a code path that
// assumes one.
func (s *UserManagementService) RenderAdminListing(ctx context.Context) (string, error) {
	admins, err := s.userRepository.GetAdmins(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to list administrators: %w", err)
	}

	if len(admins) == 0 {
		return NoAdminsMessage, nil
	}

	lines := make([]string, 0, len(admins))
	for _, admin := range admins {
		lines = append(lines, renderAdminLine(admin))
	}

	return strings.Join(lines, "\n"), nil
}

func renderAdminLine(admin *users_models.User) string {
	activeState := "inactive"
	if admin.IsActiveUser() {
		activeState = "active"
	}

	line := fmt.Sprintf(
		"%s | %s | created %s | %s",
		admin.Email,
		admin.Name,
		admin.CreatedAt.UTC().Format("2006-01-02"),
		activeState,
	)

	if admin.IsRootAdmin {
		line += " | bootstrap administrator"
	}

	return line
}
