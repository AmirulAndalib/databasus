## Purpose

Lets the owner of an instance require a second, emailed factor before a password sign-in succeeds, with the preconditions that keep the switch from locking everyone out and a console path back when mail delivery stops working.

## ADDED Requirements

### Requirement: An administrator controls the second factor for the whole instance

The instance SHALL offer a single global setting that requires a second factor for password sign-in. It SHALL be off until an administrator turns it on, SHALL apply to every account on the instance once on, and SHALL be changeable only by an administrator.

#### Scenario: Default state

- **WHEN** an instance is deployed and claimed for the first time
- **THEN** the second factor is off and sign-in works with an address and a password alone

#### Scenario: A non-administrator tries to change it

- **WHEN** a member submits a settings update that turns the second factor on
- **THEN** the update is refused and the setting is unchanged

### Requirement: The second factor cannot be turned on unless the instance can deliver codes

Turning the setting on SHALL be refused unless both conditions hold: the instance has a configured mail server, and every active administrator holds a syntactically valid email address. The refusal SHALL name which condition failed and, when an administrator address is the problem, which account it is.

The interface offering the setting SHALL explain the mail server requirement and link to the published documentation for configuring it. It SHALL decide whether the mail server is configured from the instance's own answer, so that the interface and the refusal never disagree about the same instance.

#### Scenario: No mail server

- **WHEN** an administrator turns the setting on while the instance has no mail server configured
- **THEN** the change is refused with a message naming the missing mail server
- **AND** the interface offers a link to the documentation for configuring it

#### Scenario: An administrator has no usable address

- **WHEN** an administrator turns the setting on while another active administrator still holds a value that is not an email address, such as the login `admin` an instance created before the administrator account was reworked
- **THEN** the change is refused, the message names that account, and the setting stays off

#### Scenario: Both conditions satisfied

- **WHEN** an administrator turns the setting on with a mail server configured and every active administrator holding a real address
- **THEN** the change is accepted and takes effect for the next sign-in

#### Scenario: The interface and the instance agree

- **WHEN** an administrator opens the settings screen
- **THEN** whether the setting is offered or explained as unavailable follows the same judgement about the mail server that a refusal would apply

### Requirement: Password sign-in asks for an emailed code when the second factor is on

With the setting on, a correct address and password SHALL NOT by itself produce an access token. The instance SHALL instead send a six-digit numeric code to the account's address and answer with an identifier for that pending sign-in. Presenting that identifier together with the matching code SHALL produce the access token.

The code SHALL be generated from a cryptographically secure source, SHALL be stored so that reading the stored form does not reveal it, and SHALL be usable once.

This applies to every account on the instance, including the recorded bootstrap administrator.

#### Scenario: Completing a two-step sign-in

- **WHEN** a user submits a correct address and password on an instance with the second factor on
- **THEN** no access token is returned, a six-digit code arrives at that address, and the response identifies the pending sign-in
- **AND** submitting that identifier with the received code returns an access token

#### Scenario: The bootstrap administrator signs in

- **WHEN** the recorded bootstrap administrator signs in with a correct password
- **THEN** a code is required exactly as for any other account

#### Scenario: Reusing a code

- **WHEN** a user submits a code that has already completed a sign-in
- **THEN** the attempt is rejected and no second token is issued

### Requirement: A code is sent only after the password is verified

The instance SHALL verify the password before generating or sending any code. A sign-in attempt with an unknown address or a wrong password SHALL send no mail, SHALL create no pending sign-in, and SHALL answer exactly as it does with the second factor off, so the response does not disclose whether the address exists or whether the second factor is on.

#### Scenario: Wrong password

- **WHEN** someone submits a known address with an incorrect password
- **THEN** no mail is sent and the response is the same one the instance gives with the second factor off

#### Scenario: Unknown address

- **WHEN** someone submits an address that belongs to no account
- **THEN** no mail is sent and no pending sign-in exists

### Requirement: A pending sign-in expires, tolerates few wrong guesses, and can be resent

A pending sign-in SHALL expire ten minutes after its code is issued. It SHALL be destroyed after five incorrect code submissions, after which the user starts again from the password step. An expired, destroyed or already-used pending sign-in SHALL never produce a token.

The user SHALL be able to request a new code for a pending sign-in. Resends SHALL be limited to one per minute and five per hour for the same address; a request beyond those limits SHALL be refused without sending mail.

Codes SHALL be limited to five per hour for the same account however they were requested, so that repeating the password step cannot send more mail than resending would. A request beyond that limit SHALL be refused without sending mail and without leaving a usable pending sign-in.

A pending sign-in SHALL NOT be retained after it expires.

#### Scenario: Code expires

- **WHEN** a user submits a correct code eleven minutes after it was issued
- **THEN** the attempt is rejected and no token is issued

#### Scenario: Guessing the code

- **WHEN** someone submits five incorrect codes for the same pending sign-in
- **THEN** the pending sign-in is destroyed, and the correct code submitted afterwards is also rejected

#### Scenario: Requesting another code

- **WHEN** a user whose code has not arrived requests a resend more than a minute after the last one
- **THEN** a new code is sent and the previous one no longer works

#### Scenario: Resending too often

- **WHEN** a user requests a second resend within the same minute
- **THEN** the request is refused and no mail is sent

#### Scenario: Restarting the password step to send more mail

- **WHEN** someone who knows an account's password completes the password step repeatedly until that account has received five codes within an hour, then completes it once more
- **THEN** no further mail is sent and no usable pending sign-in is produced

#### Scenario: Expired pending sign-ins are not kept

- **WHEN** pending sign-ins have expired without being used
- **THEN** the instance no longer holds them

### Requirement: The verification step re-checks what the password step checked

Before issuing an access token, the instance SHALL confirm that the account behind a pending sign-in may still be let in: it still exists, it is still active, and its password has not changed since the pending sign-in was created. A pending sign-in that fails any of these SHALL be refused, whatever code it carries.

A pending sign-in created while the second factor was on SHALL still be completable after the setting has been switched off.

#### Scenario: The account is deactivated while the code is in flight

- **WHEN** an administrator deactivates an account after its password step succeeded but before its code is submitted
- **THEN** submitting the correct code is refused and no access token is issued

#### Scenario: The password changes while the code is in flight

- **WHEN** the account's password is changed after its password step succeeded but before its code is submitted
- **THEN** submitting the correct code is refused and no access token is issued

#### Scenario: The setting is switched off while the code is in flight

- **WHEN** an operator switches the second factor off after a user's password step succeeded
- **THEN** that user can still complete the sign-in with the code they received

### Requirement: The second step is protected like the first

The endpoints that verify a code and request a resend SHALL carry the same automated-abuse protection the instance applies to password sign-in and to the password-reset code request, including its human-verification challenge when the instance has one configured.

#### Scenario: Human verification is configured

- **WHEN** an instance with human verification configured receives a code verification or a resend request without a valid challenge answer
- **THEN** the request is refused before any code is checked and before any mail is sent

### Requirement: Sign-in fails closed when the code cannot be sent

If the instance cannot send the code, the sign-in SHALL fail with a response that says the code could not be sent, and SHALL NOT issue an access token. An instance whose mail server has stopped working therefore admits nobody through password sign-in while the setting is on.

#### Scenario: Mail server unreachable

- **WHEN** a user submits a correct address and password while the mail server refuses the message
- **THEN** the response states that the code could not be sent and carries no access token

### Requirement: Sign-in through an external identity provider is not covered by the second factor

Sign-in through Google or GitHub SHALL continue to issue an access token directly, with no emailed code, whether or not the setting is on. This is a deliberate exception: those providers run their own multi-factor checks, and an instance that allows them accepts that the second factor guards only password sign-in.

Any interface or documentation that describes the second factor SHALL NOT claim it covers external identity providers.

#### Scenario: Signing in with Google while the second factor is on

- **WHEN** a user completes Google sign-in on an instance with the second factor on
- **THEN** an access token is issued without an emailed code

### Requirement: An operator can switch the second factor off from the host

An operator with shell access to the running instance SHALL be able to turn the global setting off with a single command, so that an instance whose mail server has died can be entered again without editing its database by hand. The command SHALL report what it changed, and SHALL succeed without complaint when the setting is already off.

The command SHALL be available only to a caller who can already execute commands inside the running instance, the same trust level the password-reset and administrator-listing commands require.

#### Scenario: Recovering from a dead mail server

- **WHEN** an operator who cannot receive codes runs the disable command on the host
- **THEN** the setting is off and the next password sign-in completes without a code

#### Scenario: Running it twice

- **WHEN** the operator runs the disable command on an instance where the setting is already off
- **THEN** the command reports no change and exits successfully

### Requirement: The second factor is documented as part of the product's security story

The published documentation SHALL state that the instance can require an emailed second factor at sign-in, in the security material of both the repository readme and the website - the website's dedicated security page as well as the security question answered on its home page - in every language each ships. The console command that switches the second factor off SHALL be documented beside the other recovery commands, so an owner locked out by a broken mail server finds it where they already look for password recovery.

#### Scenario: A reader looks up what protects sign-in

- **WHEN** a reader consults the published security material in any of the six languages
- **THEN** it states that sign-in can require an emailed code, and does not claim that this covers sign-in through an external identity provider

#### Scenario: An owner locked out by a broken mail server

- **WHEN** that owner reads the published password and recovery documentation
- **THEN** it names the command that switches the second factor off and shows how to run it
