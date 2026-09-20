## Purpose

Defines which MySQL and MariaDB server versions Databasus accepts for backup, how the version it detects governs the tooling and the safety checks applied to that database, and how it behaves when it meets a server it ships no client for.

## ADDED Requirements

### Requirement: Supported MySQL server versions are accepted

The system SHALL accept a MySQL server reporting major version 5, 8, 9 or 26 when it ships a client for that server's release line on the running architecture, and SHALL record a version identity that names the line the server belongs to rather than its exact version.

#### Scenario: Add a MySQL server on a previously supported line

- **WHEN** an authorized user tests the connection to a reachable MySQL server reporting version 5.7, 8.0, 8.4 or 9.x with sufficient backup privileges
- **THEN** the connection test succeeds and the database records the matching version identity

#### Scenario: Add a MySQL server on the calendar scheme

- **WHEN** an authorized user tests the connection to a reachable MySQL server reporting version 26.7 with sufficient backup privileges
- **THEN** the connection test succeeds and the database records a version identity of 26 rather than the identity of an earlier line

#### Scenario: A later release inside the calendar line

- **WHEN** an authorized user tests the connection to a MySQL server on a release later than the newest 26.x client the product ships, while still inside the 26 line
- **THEN** the connection test succeeds, the database records the identity 26, and the shipped 26 client is used

#### Scenario: Managed MySQL reporting a vendor suffix

- **WHEN** the MySQL server reports its version with a vendor suffix, such as `26.7.0-cloud` on a managed instance
- **THEN** the system reads the version from the leading numbers and accepts the server

### Requirement: Supported MariaDB server versions are accepted

The system SHALL accept a MariaDB server reporting major version 5, 10, 11, 12 or 13, and SHALL record a version identity that names the line the server belongs to rather than its exact version.

#### Scenario: Add a MariaDB 13 server

- **WHEN** an authorized user tests the connection to a reachable MariaDB server reporting version 13.0 with sufficient backup privileges
- **THEN** the connection test succeeds and the database records a version identity of 13.0

#### Scenario: A later minor inside the MariaDB 13 line

- **WHEN** an authorized user tests the connection to a MariaDB server reporting a 13.x version later than the client the product ships for that line, such as 13.2 against a 13.0 client
- **THEN** the connection test succeeds and the server is served by the shipped 13 client, because the client and the server belong to the same release line

#### Scenario: Add a MariaDB server on a previously supported line

- **WHEN** an authorized user tests the connection to a reachable MariaDB server reporting version 5.5, 10.x, 11.x or 12.x with sufficient backup privileges
- **THEN** the connection test succeeds and the database records the matching version identity

### Requirement: A server on an unserved release line is refused, never dumped by a client from an older line

The system SHALL refuse a MySQL or MariaDB server whose release line no shipped client serves, and SHALL never dump such a server with a client from an earlier line, so that no backup is produced by a program from a generation that does not know the server's features. Within one release line the client may be older than the server: that gap is closed by refreshing the bundle, not by refusing the database.

#### Scenario: Server on a release line the product ships no client for

- **WHEN** an authorized user tests the connection to a reachable MySQL or MariaDB server whose release line is newer than every line the product ships a client for, such as a MariaDB 14.1 server while the newest MariaDB client serves the 13 line
- **THEN** the connection test fails, names the versions the product supports, and no database is added

#### Scenario: Server ahead of its client inside a served line

- **WHEN** an authorized user tests the connection to a server whose release line is served but whose own version is newer than the client shipped for that line, such as a MariaDB 13.2 server against a 13.0 client
- **THEN** the connection test succeeds and the database is served by that line's client

#### Scenario: Release line whose client exists on one architecture only

- **WHEN** an authorized user tests the connection to a server whose client is absent for the architecture the product runs on, such as MySQL 5.7 on an arm64 deployment
- **THEN** the connection test fails and reports that this version is unsupported on this architecture

#### Scenario: A database recorded before its client became unavailable

- **WHEN** a backup starts for a database whose recorded version has no client on the architecture the product now runs on
- **THEN** the backup fails with a message naming the version and the architecture, rather than with a missing-file error

#### Scenario: A newer client serves an older line by design

- **WHEN** a server's release line has no client of its own but a newer shipped client is designated to serve that line, as the modern MariaDB client serves every line from 10.2 up
- **THEN** the server is accepted and that client is used

### Requirement: An unusable server is rejected with a reason

The system SHALL refuse a server it cannot serve and SHALL name what it found, so that the user can correct the choice rather than discover the problem when a backup fails.

#### Scenario: MariaDB server added under the MySQL type

- **WHEN** an authorized user tests a connection to a MariaDB server while the database type is MySQL
- **THEN** the connection test fails, reports the version it found and directs the user to the MariaDB type

#### Scenario: Version string cannot be read

- **WHEN** the server answers the version query with a value the system cannot parse
- **THEN** the connection test fails and reports the value it received

#### Scenario: MySQL major below the supported range

- **WHEN** a MySQL server reports a major version below 5
- **THEN** the connection test fails and names the versions the system supports

#### Scenario: MariaDB major below the supported range

- **WHEN** a MariaDB server reports a major version below 5
- **THEN** the connection test fails and names the versions the system supports

### Requirement: The downgrade guard covers every accepted version

The system SHALL refuse to restore a backup taken from a newer server onto an older server for every MySQL and MariaDB version it accepts, including versions added after the guard was written.

#### Scenario: Restore a calendar-scheme MySQL backup onto an earlier line

- **WHEN** an authorized user requests a restore of a backup taken from a MySQL 26.x server onto a MySQL 9.x or 8.x server
- **THEN** the system refuses the restore and explains that the backup comes from a newer server

#### Scenario: Restore a MariaDB 13 backup onto MariaDB 12

- **WHEN** an authorized user requests a restore of a backup taken from a MariaDB 13.x server onto a MariaDB 12.x server
- **THEN** the system refuses the restore and explains that the backup comes from a newer server

#### Scenario: Restore onto an equal or newer server

- **WHEN** an authorized user requests a restore of a backup onto a server of the same or a newer version identity
- **THEN** the system allows the restore

### Requirement: Backups of new versions use the modern transfer settings

The system SHALL apply the same network compression negotiation to newly supported MySQL versions as it applies to MySQL 8.0 and later, rather than falling back to the legacy setting reserved for MySQL 5.7.

#### Scenario: Back up a calendar-scheme MySQL server

- **WHEN** a backup of a MySQL 26.x database starts
- **THEN** the system negotiates compression from the modern algorithm set and falls back through it to an uncompressed transfer if the server or its proxy refuses

### Requirement: The displayed version is never blank

The system SHALL display a version for every MySQL and MariaDB database it accepted, for every version identity it can record.

#### Scenario: View a database on a newly supported version

- **WHEN** an authorized user views a MySQL 26.x or MariaDB 13.x database
- **THEN** the version field shows that version rather than an empty value
