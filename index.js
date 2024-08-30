const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const { createTunnel } = require("tunnel-ssh");
const axios = require("axios");

require("dotenv").config({ path: path.join(__dirname, ".env") });

function getBackupDirectoryPath() {
  const backupDirectory = process.env.BACKUP_DIRECTORY || "./backups";
  return path.join(__dirname, backupDirectory);
}

async function createSSHTunnel() {
  if (process.env.SSH_ENABLED !== "1") {
    console.log(
      "Skipping SSH tunnel creation because SSH is disabled in the configuration."
    );
    const baseUrl = `${process.env.COUCHDB_PROTOCOL}://${process.env.COUCHDB_HOST}:${process.env.COUCHDB_PORT}`;
    console.log("Base URL:", baseUrl);
    return { baseUrl, tunnel: null };
  }

  const sshOptions = {
    host: process.env.SSH_HOST,
    port: process.env.SSH_PORT || 22,
  };

  if (process.env.SSH_PRIVATE_KEY_PATH) {
    console.log("Using SSH private key for authentication.");
    sshOptions.privateKey = fs.readFileSync(process.env.SSH_PRIVATE_KEY_PATH);
  } else if (process.env.SSH_USERNAME && process.env.SSH_PASSWORD) {
    sshOptions.username = process.env.SSH_USERNAME;
    sshOptions.password = process.env.SSH_PASSWORD;
  } else {
    throw new Error(
      "Either SSH private key or username/password must be provided."
    );
  }

  const forwardOptions = {
    srcAddr: process.env.FORWARD_SRC_ADDR,
    srcPort: process.env.FORWARD_SRC_PORT,
    dstAddr: process.env.FORWARD_DST_ADDR,
    dstPort: process.env.FORWARD_DST_PORT,
  };

  const tunnelOptions = {
    autoClose: false,
  };

  const serverOptions = {
    port: forwardOptions.srcPort,
  };

  try {
    const tunnel = await createTunnel(
      tunnelOptions,
      serverOptions,
      sshOptions,
      forwardOptions
    );
    console.log("SSH tunnel successfully established.");
    const baseUrl = `${process.env.COUCHDB_PROTOCOL}://127.0.0.1:${forwardOptions.srcPort}`;
    console.log("Base URL (via SSH):", baseUrl);

    return {
      baseUrl,
      tunnel,
    };
  } catch (error) {
    console.error("Failed to establish SSH tunnel:", error);
    throw error;
  }
}

function getFileSizeInMB(filePath) {
  const stats = fs.statSync(filePath);
  return (stats.size / (1024 * 1024)).toFixed(2) + " MB";
}

function getDirectorySizeInMB(directoryPath) {
  const files = fs.readdirSync(directoryPath);
  let totalSize = 0;

  files.forEach((file) => {
    const filePath = path.join(directoryPath, file);
    const stats = fs.statSync(filePath);
    totalSize += stats.size;
  });

  return (totalSize / (1024 * 1024)).toFixed(2) + " MB";
}

function backupDatabase(baseUrl, databaseName) {
  return new Promise((resolve, reject) => {
    const url = `${baseUrl}/${databaseName}/_all_docs?include_docs=true`;
    const filePath = path.join(
      getBackupDirectoryPath(),
      `${databaseName}-${new Date().toISOString()}.json`
    );
    console.log(`Backing up ${databaseName} to ${filePath}`);
    const curlCommand = `curl -u ${process.env.COUCHDB_USERNAME}:${process.env.COUCHDB_PASSWORD} ${url} -o ${filePath}`;

    exec(curlCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`Failed to backup database ${databaseName}:`, stderr);
        return reject(error);
      }
      console.log(`Successfully backed up database ${databaseName}.`);
      resolve({ databaseName, filePath });
    });
  });
}

function cleanupOldBackups() {
  const retentionPeriod = process.env.DATA_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();

  fs.readdir(getBackupDirectoryPath(), (err, files) => {
    if (err) {
      console.error("Failed to read backup directory:", err);
      return;
    }

    files.forEach((file) => {
      const filePath = path.join(getBackupDirectoryPath(), file);
      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error("Failed to retrieve file info:", err);
          return;
        }

        if (now - stats.mtime.getTime() > retentionPeriod) {
          fs.unlink(filePath, (err) => {
            if (err) {
              console.error(`Failed to delete file ${filePath}:`, err);
            } else {
              console.log(`Deleted old backup ${filePath}.`);
            }
          });
        }
      });
    });
  });
}

async function backupAllDatabases() {
  if (!fs.existsSync(getBackupDirectoryPath())) {
    fs.mkdirSync(getBackupDirectoryPath(), { recursive: true });
  }

  try {
    const { baseUrl, tunnel } = await createSSHTunnel();
    const databases = process.env.DATABASES.split(",").map((db) => db.trim());
    const backupDetails = [];

    for (const dbName of databases) {
      const { databaseName, filePath } = await backupDatabase(baseUrl, dbName);
      const fileSize = getFileSizeInMB(filePath);
      backupDetails.push(`${databaseName} was saved with ${fileSize}`);
    }

    // Clean up old backups
    cleanupOldBackups();

    const backupDirectorySize = getDirectorySizeInMB(getBackupDirectoryPath());

    const message = `Backup completed.\n\n${backupDetails.join(
      "\n"
    )}\n\nEntire backup directory is now ${backupDirectorySize} big.`;

    // Send Slack message
    await sendSlackMessage(message);

    // Close the tunnel if one was created
    if (tunnel) {
      tunnel[0].close();
      console.log("SSH tunnel closed.");
    }

    // Exit the script
    process.exit(0);
  } catch (error) {
    await sendSlackMessage(
      "Backup process failed. Check the logs for details."
    );
    console.error("Failed to start backup process:", error);
    process.exit(1);
  }
}

async function sendSlackMessage(message) {
  if (!process.env.SLACK_WEBHOOK_URL) {
    return;
  }

  try {
    await axios.post(process.env.SLACK_WEBHOOK_URL, {
      text: message,
    });
    console.log("Slack message sent successfully.");
  } catch (error) {
    console.error("Failed to send Slack message:", error);
  }
}

// Start the backup process
backupAllDatabases();
