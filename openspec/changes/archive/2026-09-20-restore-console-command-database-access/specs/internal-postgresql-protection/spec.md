## MODIFIED Requirements

### Requirement: Internal PostgreSQL credentials are generated at startup

When Databasus uses its embedded metadata database, the container SHALL generate a cryptographically random PostgreSQL password at startup, set it on the internal role, and supply it to the application without logging it. A container restart SHALL replace the previous password. An explicitly supplied external metadata-database connection string SHALL remain unchanged.

The generated connection string SHALL also be readable by processes that start later in the same container, so that a command run against a running instance authenticates with the same credential as the application. That value SHALL exist only for the lifetime of the running container: it SHALL NOT be written to storage that survives a container stop, and it SHALL NOT be part of the distributed image.

When the operator supplies a metadata-database connection string, startup SHALL neither generate nor publish one, and every process in the container SHALL use the supplied value. When the operator supplies none, every process SHALL use the generated one. No process SHALL fall back to a connection string shipped as a default inside the image.

An operator-supplied connection string that points back to the embedded database with the previously published fixed password is incompatible with rotation and SHALL NOT be treated as a supported embedded-database configuration.

#### Scenario: Fresh container startup

- **WHEN** a container starts without an explicit metadata-database connection string
- **THEN** it configures the embedded role and the application with the same generated password
- **AND** the application becomes healthy without printing that password

#### Scenario: Container restart

- **WHEN** the same container restarts
- **THEN** the embedded role receives a different generated password
- **AND** the application reconnects with the new password
- **AND** a command started after the restart authenticates with the new password rather than the previous one

#### Scenario: Previously published fixed password

- **WHEN** a client attempts loopback TCP authentication with the old fixed image password
- **THEN** PostgreSQL rejects the connection

#### Scenario: External metadata database

- **WHEN** the operator explicitly supplies a connection string for an external metadata database
- **THEN** startup preserves that value rather than replacing it with the embedded database connection
- **AND** startup publishes no generated connection string for other processes to pick up

#### Scenario: Explicit connection string points to the embedded database

- **WHEN** the operator explicitly supplies the previously published fixed connection string for the embedded database
- **THEN** the application cannot authenticate after startup rotates the internal role's password
- **AND** the operator must remove that explicit value so startup can supply the generated credential

## ADDED Requirements

### Requirement: Console commands reach the metadata database of a running container

A console command executed inside an already-running container SHALL resolve the metadata-database connection the same way the application did, and SHALL connect successfully whenever the application itself is connected. This SHALL hold for a container using the embedded database and for one pointed at an external metadata database.

An operator-supplied connection string SHALL take precedence over the one startup generated. A console command SHALL NOT need any argument, file or environment value beyond what the operator already supplied to the container.

#### Scenario: Password reset on a fresh instance

- **WHEN** an operator runs the documented password-reset command inside a running container that uses the embedded database
- **THEN** the command connects to the metadata database and sets the new password
- **AND** the operator can sign in with it

#### Scenario: Console command against an external metadata database

- **WHEN** the operator supplied a connection string for an external metadata database and runs a console command
- **THEN** the command connects to that external database

#### Scenario: Console command while the application is running

- **WHEN** a console command runs while the application holds its own connection to the embedded database
- **THEN** both connect with the same credential and neither disturbs the other

### Requirement: Missing metadata-database configuration is reported as such

When no metadata-database connection string is available from any source, a starting process SHALL report that the configuration is missing and SHALL NOT attempt a connection with a default credential. A rejected credential and an absent configuration SHALL produce distinguishable messages.

A process that never opens the metadata database SHALL be exempt from this requirement, because container startup runs the storage probe before the embedded database exists.

#### Scenario: No connection string anywhere

- **WHEN** a process starts in a container where startup published no connection string and the operator supplied none
- **THEN** it reports the metadata-database configuration as missing
- **AND** the message does not describe an authentication failure

#### Scenario: Storage probe before the database exists

- **WHEN** container startup runs the storage probe, before any metadata-database credential exists
- **THEN** the probe completes on its own merits rather than being refused for a missing connection string

#### Scenario: Wrong credential supplied

- **WHEN** a process starts with a connection string whose password the database rejects
- **THEN** it reports an authentication failure rather than a missing configuration

### Requirement: The shared internal credential stays inside the container

The published connection string SHALL be readable only by the account that runs Databasus and by the container's privileged account. Any other account inside the container SHALL be refused. The value SHALL NOT appear in logs, in the image, or on any volume the operator mounts.

#### Scenario: Another account in the container

- **WHEN** a process running under an operating-system account other than the Databasus runtime account attempts to read the published connection string
- **THEN** the read is refused

#### Scenario: Operator inspects the mounted data volume

- **WHEN** the operator inspects the mounted data directory after the container has started
- **THEN** the generated password is absent from it

#### Scenario: Operator inspects a stopped container's image

- **WHEN** the operator inspects the distributed image
- **THEN** it contains no metadata-database connection string usable against the embedded database
