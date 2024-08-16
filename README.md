
# CouchDB Backup Script with Optional SSH Tunneling

This script is designed to back up CouchDB databases, with optional support for creating an SSH tunnel to securely connect to remote CouchDB instances. It supports configuration through environment variables, making it flexible and easy to use in various deployment environments.

## Features

- **Backup CouchDB Databases**: Automatically backs up specified CouchDB databases to a designated directory.
- **Optional SSH Tunneling**: Supports connecting to remote CouchDB instances via SSH tunneling. Both SSH private key and username/password authentication methods are supported.
- **Automatic Backup Retention**: Cleans up old backups based on a configurable retention period.

## Prerequisites

- Node.js
- npm
- CouchDB instance
- SSH access to the remote server (if using SSH tunneling)

## Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-repo/couchdb-backup-script.git
   cd couchdb-backup-script
   ```

2. **Install Dependencies**:
   ```bash
   npm ci
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the project root with the necessary configuration options (see below).

## Configuration

The script is configured using environment variables. Below is a list of all available configuration options:

| Environment Variable      | Description                                                                 | Default               | Required |
|---------------------------|-----------------------------------------------------------------------------|-----------------------|----------|
| `COUCHDB_HOST`             | The host address of the CouchDB instance.                                   | `127.0.0.1`           | Yes      |
| `COUCHDB_PROTOCOL`         | The protocol to use (e.g., `http`, `https`).                                | `http`                | Yes      |
| `COUCHDB_PORT`             | The port on which CouchDB is running.                                       | `5984`                | Yes      |
| `COUCHDB_USERNAME`         | The username for CouchDB authentication.                                    |                       | Yes      |
| `COUCHDB_PASSWORD`         | The password for CouchDB authentication.                                    |                       | Yes      |
| `SSH_ENABLED`              | Enable SSH tunneling (`1` for enabled, `0` for disabled).                   | `0`                   | Yes      |
| `SSH_HOST`                 | The SSH server's host address.                                              |                       | If SSH is enabled |
| `SSH_PORT`                 | The SSH server's port.                                                      | `22`                  | If SSH is enabled |
| `SSH_USERNAME`             | The username for SSH authentication.                                        | `root`                | If SSH is enabled and no private key is provided |
| `SSH_PASSWORD`             | The password for SSH authentication.                                        |                       | If SSH is enabled and no private key is provided |
| `SSH_PRIVATE_KEY_PATH`     | Path to the SSH private key file.                                           |                       | If SSH is enabled and no username/password is provided |
| `FORWARD_SRC_HOST`         | The local address for the forwarded port.                                   | `127.0.0.1`           | Yes      |
| `FORWARD_SRC_PORT`         | The local port for the forwarded connection.                                | `5999`                | Yes      |
| `FORWARD_DST_HOST`         | The remote address on the SSH server to forward to.                         | `127.0.0.1`           | Yes      |
| `FORWARD_DST_PORT`         | The remote port on the SSH server to forward to (typically CouchDB's port). | `5984`                | Yes      |
| `DATABASES`                | Comma-separated list of CouchDB database names to back up.                  |                       | Yes      |
| `DATA_RETENTION_DAYS`      | Number of days to retain backup files before deletion.                      | `14`                  | Yes      |
| `BACKUP_DIRECTORY`         | Directory where backup files will be stored.                                | `./backups`           | Yes      |

## Example `.env` File

```dotenv
COUCHDB_HOST=127.0.0.1
COUCHDB_PROTOCOL=http
COUCHDB_PORT=5984
COUCHDB_USERNAME=admin
COUCHDB_PASSWORD=secret

SSH_ENABLED=1
SSH_HOST=remote.server.com
SSH_PORT=22
SSH_USERNAME=root
SSH_PASSWORD=yourpassword
#SSH_PRIVATE_KEY_PATH=/path/to/private/key

FORWARD_SRC_HOST=127.0.0.1
FORWARD_SRC_PORT=5999
FORWARD_DST_HOST=127.0.0.1
FORWARD_DST_PORT=5984

DATABASES=db1,db2,db3
DATA_RETENTION_DAYS=14
BACKUP_DIRECTORY=./backups
```

## How to Use

### 1. Manual Execution

To manually start the backup process, simply run:

```bash
node index.js
```

This will start the backup process based on the configuration specified in your `.env` file.

### 2. Running the Script Automatically with `cron`

To automate the backup process, you can schedule it using `cron`. Here's how to set up a cron job:

1. Open your crontab file:
   ```bash
   crontab -e
   ```

2. Add the following line to schedule the backup script (e.g., to run it daily at 2 AM):
   ```bash
   0 2 * * * /usr/bin/node /path/to/your/project/index.js >> /path/to/your/project/backup.log 2>&1
   ```

   - Make sure to replace `/path/to/your/project/` with the actual path to your project.
   - The output and errors will be logged in `backup.log`.

3. Save and close the crontab editor.

## How It Works

1. **SSH Tunnel Creation (Optional)**: 
   - If `SSH_ENABLED` is set to `1`, the script establishes an SSH tunnel to the remote server, forwarding the specified local port to the remote CouchDB instance.

2. **Database Backup**:
   - The script backs up each specified CouchDB database by fetching all documents and saving them as JSON files in the backup directory.

3. **Old Backup Cleanup**:
   - After backing up the databases, the script checks the backup directory and deletes any backup files older than the specified retention period.

4. **Shutdown**:
   - If an SSH tunnel was established, it is closed before the script exits.

## Notes

- Ensure that the `BACKUP_DIRECTORY` is writable by the script.
- If using SSH tunneling, make sure that your SSH credentials or private key are properly configured.

## License

This project is licensed under the MIT License.
