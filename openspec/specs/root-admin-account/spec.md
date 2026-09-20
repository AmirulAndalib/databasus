# Root Admin Account Specification

## Purpose

Describes how a Databasus instance gets the administrator account its owner works from: how that account is created on a new instance, what happens to the account older instances were shipped with, how the instance keeps recognizing it once its email address changes, which powers it holds over other administrators, and how an owner who has forgotten the address recovers it from the host.

## Requirements

### Requirement: A new instance creates no account until somebody registers

A started instance SHALL NOT create any account on its own. An instance that holds no account SHALL offer account creation as the way in, and SHALL say that the account being created administers the instance.

Creating that account SHALL require nothing the owner cannot supply locally: no delivered email, no outbound network access and no configured mail server.

An instance that already holds an account SHALL offer the ordinary way in - signing in, and creating an account where the registration policy allows it - and SHALL NOT repeat that the account being created administers the instance.

The instance SHALL NOT offer any way to set a password on an account that already exists without either authenticating as that account or proving control of its address with an emailed reset code. Claiming an instance is account creation; recovering an account whose password is lost is the emailed reset or a command run inside the instance.

#### Scenario: Opening a freshly deployed instance

- **WHEN** an owner opens a freshly started instance that has no mail server configured and no network access
- **THEN** the instance offers to create an account, saying that it will administer the instance
- **AND** no account exists on the instance until that form is submitted

#### Scenario: Setting up without any mail server

- **WHEN** the owner submits the form on that instance
- **THEN** the account is created and the owner is signed in as an administrator, with no email sent

#### Scenario: Opening an instance that already holds accounts

- **WHEN** a visitor opens an instance on which at least one account exists
- **THEN** the entry screen offers signing in, and says nothing about the first account administering the instance

#### Scenario: An anonymous caller tries to set a password on an existing account

- **WHEN** an unauthenticated caller attempts to set a password on an account that already exists, without an emailed reset code
- **THEN** the instance refuses, whether or not that account currently has a password

### Requirement: The first account on an empty instance administers it

The first account created on an instance that holds no other account SHALL receive the administrator role and SHALL be recorded as the instance's bootstrap administrator. This SHALL hold however the account is created, including a first sign-in through an external identity provider, and SHALL NOT depend on whether open registration is enabled.

An instance SHALL never record more than one bootstrap administrator, including when two accounts are created at the same moment.

An account created by registration SHALL carry a syntactically valid email address, so that the administrator of an instance always has an address the product can deliver to. An account created through an external identity provider carries the address that provider reports for it.

Recording an account as the bootstrap administrator SHALL be visible in the audit log, so the log explains where that account's privileges came from.

**BREAKING**: registration previously accepted any non-empty value as the email address. A value that is not an email address is now refused.

#### Scenario: The first registration takes the instance

- **WHEN** the first person registers on an instance that holds no account
- **THEN** that account holds the administrator role and is the recorded bootstrap administrator
- **AND** the audit log holds an entry naming that account as the instance's administrator

#### Scenario: The first sign-in through an external provider takes the instance

- **WHEN** the first person to reach an empty instance signs in through Google or GitHub instead of registering
- **THEN** the account created for them holds the administrator role and is the recorded bootstrap administrator

#### Scenario: A later registration is an ordinary account

- **WHEN** somebody registers on an instance that already holds an account
- **THEN** the new account holds the member role and the recorded bootstrap administrator is unchanged

#### Scenario: Two people register at the same moment

- **WHEN** two accounts are created concurrently on an empty instance
- **THEN** exactly one of them is recorded as the bootstrap administrator

#### Scenario: Registering with a value that is not an address

- **WHEN** somebody submits a registration whose email is not a valid email address
- **THEN** the registration is refused and no account is created

### Requirement: An upgraded instance keeps the account its owner already uses

An instance upgraded from a version that created an account with the login `admin` at startup SHALL carry the bootstrap-administrator record onto the account its owner already signs in with, so the upgrade changes nothing that owner can observe.

An upgraded instance whose account was never claimed - it has no password and no linked external identity, so nobody has ever signed in with it - and which holds no other account SHALL be left in the state of a new instance: that account is removed, and the first account created afterwards administers the instance.

An instance whose account was never claimed while other accounts already exist SHALL keep that account and record it as the bootstrap administrator. No upgrade SHALL leave an instance that holds accounts without a recognized bootstrap administrator, and the owner of such an instance SHALL be able to take that account over from the host, the same way a lost password is recovered.

#### Scenario: Upgrading an instance in use

- **WHEN** an instance whose owner has been signing in as `admin` is upgraded
- **THEN** that account is the recorded bootstrap administrator
- **AND** the owner signs in exactly as before, with the address `admin` and the same password

#### Scenario: Upgrading an instance nobody ever set up

- **WHEN** an instance that was deployed but never claimed, and holds nothing else, is upgraded
- **THEN** it holds no account, and the first account created on it administers it

#### Scenario: Upgrading an instance that was never claimed but already holds accounts

- **WHEN** an instance whose placeholder account was never signed in with, but which holds other accounts, is upgraded
- **THEN** that placeholder account is kept and recorded as the bootstrap administrator
- **AND** the owner can give it a password from the host and then move it to a real address

### Requirement: The instance recognizes its bootstrap administrator independently of that account's email address

The instance SHALL record which account is the bootstrap administrator when it creates that account, and SHALL keep recognizing it by that record. No decision about that account SHALL depend on the text of any account's email address. This covers, at minimum, every privilege the requirement below reserves for the bootstrap administrator.

#### Scenario: The bootstrap administrator keeps its role after changing address

- **WHEN** the bootstrap administrator changes their email address
- **THEN** the instance still treats that account as the bootstrap administrator

#### Scenario: Restarting the instance

- **WHEN** an instance is restarted
- **THEN** no account is created, and the recorded bootstrap administrator is unchanged

### Requirement: The bootstrap administrator keeps its powers over other administrators after changing address

Granting or revoking the administrator role, deactivating an account that holds it, and reactivating one SHALL remain reserved for the bootstrap administrator, and SHALL be permitted on the basis of the instance's record of which account that is. Changing the bootstrap administrator's email address SHALL NOT remove any of these powers, and SHALL NOT grant them to any other account.

#### Scenario: Appointing an administrator after the address has changed

- **WHEN** the bootstrap administrator, having changed its address, grants the administrator role to another user
- **THEN** the role is granted

#### Scenario: Another administrator still cannot manage administrators

- **WHEN** an account that holds the administrator role but is not the bootstrap administrator tries to grant the role, revoke it, or deactivate or reactivate an account holding it
- **THEN** every one of those attempts is refused, whatever address the bootstrap administrator currently holds

#### Scenario: The bootstrap administrator cannot be stripped of its role

- **WHEN** any account attempts to revoke the administrator role from the bootstrap administrator or to deactivate it
- **THEN** the attempt is refused, so the instance is never left without a recognized bootstrap administrator

### Requirement: The bootstrap administrator can change their email address

The bootstrap administrator SHALL be able to change their email address through the same profile update every other user has, with no field locked and no explanation of why it is locked. The instance SHALL accept only a syntactically valid email address, and SHALL refuse an address another account already holds.

After the change, the administrator SHALL sign in with the new address, and the previous value SHALL no longer be accepted for that account. The administrator's existing session SHALL survive the change.

#### Scenario: An upgraded instance moves off the placeholder address

- **WHEN** the bootstrap administrator of an upgraded instance submits a real email address in place of `admin`
- **THEN** the change is accepted, and the audit log holds an entry naming the old and the new address
- **AND** the next sign-in succeeds with the new address and fails with `admin`

#### Scenario: Editing the address on the profile screen

- **WHEN** the bootstrap administrator opens their profile
- **THEN** the email field is editable and carries no notice that the address cannot be changed

#### Scenario: Rejecting a value that is not an address

- **WHEN** an administrator submits a new email value that is not a valid email address
- **THEN** the change is rejected and the stored address is unchanged

#### Scenario: Rejecting an address another account already holds

- **WHEN** the bootstrap administrator submits an address that belongs to another user
- **THEN** the change is rejected and the stored address is unchanged

### Requirement: An administrator can reset their password by email

The ordinary password reset SHALL work for the bootstrap administrator on the same terms as for any other user: a code is sent to the stored address, and it expires, is single-use and is rate-limited exactly as it is elsewhere. On a new instance this holds from the moment the account is created; on an upgraded one it holds as soon as the owner replaces the placeholder address.

A reset requested while an upgraded account still holds the placeholder address `admin` SHALL NOT deliver a code, because no mail server can reach that address. What the caller is told in that case is the existing behavior of the reset flow and is not specified here.

#### Scenario: Resetting the administrator's password by email

- **WHEN** the bootstrap administrator requests a password reset for their stored address
- **THEN** a reset code is sent to that address
- **AND** submitting the code sets a new password

### Requirement: Sign-in refuses cleanly and discloses nothing about the accounts an instance holds

A failed sign-in SHALL NOT tell the caller that an account with the login `admin` exists on the instance, SHALL NOT suggest signing in under that login, and SHALL NOT reveal how many accounts the instance holds. This applies regardless of how many accounts there are.

A sign-in attempt for an account that has no password - one created through an external identity provider, or an unclaimed account on an instance that has not yet been upgraded - SHALL be refused the way an incorrect password is refused, and SHALL leave the instance serving other requests.

**BREAKING**: an instance holding a single user previously answered a sign-in attempt with an unknown address by naming the `admin` login. That response is removed; an owner recovers the address from the console instead.

#### Scenario: Mistyped address on a single-user instance

- **WHEN** an anonymous visitor attempts to sign in to an instance that holds only its administrator, using an address that does not exist
- **THEN** the response does not mention the login `admin` and does not reveal how many accounts the instance holds

#### Scenario: Password sign-in for an account that has no password

- **WHEN** somebody submits the password form for an account that signs in through Google or GitHub
- **THEN** the attempt is refused in the same way an incorrect password is refused
- **AND** the instance keeps answering every other request

### Requirement: An owner can recover the administrator addresses from the host

An operator with shell access to the running instance SHALL be able to list every account holding the administrator role, seeing for each one its email address, its display name, when it was created, whether it is still active, and whether it is the bootstrap administrator. The active state is part of the answer because a deactivated administrator explains why an address does not let its owner in. The listing SHALL print no password, no password hash, no token and no other secret.

The listing SHALL be available only to a caller who can already execute commands inside the running instance, which is the same trust level the existing password-reset command requires.

#### Scenario: Recovering a forgotten address

- **WHEN** an owner who cannot remember which address to sign in with runs the administrator listing command on the host
- **THEN** the output names every administrator account with its address, display name, creation date and active state, and marks the bootstrap administrator
- **AND** the output contains no password material

#### Scenario: Listing on an instance nobody has set up

- **WHEN** the listing command runs on an instance where no account has been created yet
- **THEN** it reports that the instance has no administrator, and lists nothing

### Requirement: Setting up and recovering an instance are documented

The product documentation SHALL describe how an instance gets its administrator - the first account created on it - and SHALL describe both how to reset an administrator password and how to recover a forgotten administrator address, in the same place and in every language the documentation ships. The public documentation SHALL also answer the question of what to do when the administrator address or password is lost, and link to those steps.

Documented command examples SHALL NOT present `admin` as the address an owner is expected to use, and the documentation SHALL NOT describe the instance as holding a user named `admin`. Where the placeholder address is mentioned at all, it SHALL be as the account an instance created before this change still carries until its owner replaces it.

#### Scenario: An owner searches the documentation

- **WHEN** an owner who cannot sign in reads the published password documentation
- **THEN** it explains both resetting the password and listing the administrator addresses
- **AND** the same guidance is reachable from the questions answered on the home page

#### Scenario: Reading about roles

- **WHEN** a reader consults the access-management documentation in any of the six published languages
- **THEN** it describes the first account created on the instance as its administrator, without claiming that account's address is `admin`
