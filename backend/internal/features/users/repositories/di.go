package users_repositories

var (
	userRepository          = &UserRepository{}
	usersSettingsRepository = &UsersSettingsRepository{}
	passwordResetRepository = &PasswordResetRepository{}
	twoFactorRepository     = &TwoFactorRepository{}
)

func GetUserRepository() *UserRepository {
	return userRepository
}

func GetUsersSettingsRepository() *UsersSettingsRepository {
	return usersSettingsRepository
}

func GetPasswordResetRepository() *PasswordResetRepository {
	return passwordResetRepository
}

func GetTwoFactorRepository() *TwoFactorRepository {
	return twoFactorRepository
}
