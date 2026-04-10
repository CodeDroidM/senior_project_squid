const net = require('net');
const readline = require('readline');
const { Buffer } = require('buffer');

class DbSrcAgentClient {
    constructor(serverAddress = 'www.compute-mertjiandata.com', serverPort = 9000) {
        this.SERVER_ADDRESS = serverAddress;
        this.SERVER_PORT = serverPort;
        this.PASSWORD = 'dbsrc$admin2024!';
        this.client = null;
        this.connected = false;
    }

    // Base64 encode password
    encodePassword(password) {
        return Buffer.from(password).toString('base64');
    }

    // Connect to the agent
   connectAgent() {
    return new Promise((resolve, reject) => {
        this.client = new net.Socket();

        let buffer = "";

        const onData = (chunk) => {
            buffer += chunk.toString("utf8");

            let idx;
            while ((idx = buffer.indexOf("\n")) !== -1) {
                const message = buffer.slice(0, idx);
                buffer = buffer.slice(idx + 1);

                try {
                    const response = JSON.parse(message);
                    console.log("Server response (connect):", response);

                    this.client.off("data", onData);

                    if (response.err_code === "0") {
                        this.connected = true;
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                } catch (e) {
                    console.error("Invalid JSON during connect:", message);
                }
            }
        };

        this.client.on("data", onData);

        this.client.on("error", (err) => {
            this.client.off("data", onData);
            reject(err);
        });

        this.client.connect(this.SERVER_PORT, this.SERVER_ADDRESS, () => {
            const jsonRequest = JSON.stringify({
                password: this.encodePassword(this.PASSWORD),
                action: "agent.connect"
            });

            this.client.write(jsonRequest + "\n");
        });
    });
}


   
   // Send a message to the agent
sendMessage(action) {
    return new Promise((resolve) => {
        if (!this.connected) {
            resolve(JSON.stringify({
                err_code: "1",
                err_msg: "Not connected to the server."
            }));
            return;
        }

        const jsonRequest = JSON.stringify({
            password: this.encodePassword(this.PASSWORD),
            action
        });

        let buffer = "";

        const onData = (chunk) => {
            buffer += chunk.toString("utf8");

            let idx;
            while ((idx = buffer.indexOf("\n")) !== -1) {
                const message = buffer.slice(0, idx);
                buffer = buffer.slice(idx + 1);

                // 🔑 VERY IMPORTANT
                this.client.off("data", onData);

                try {
                    const response = JSON.parse(message);
                    console.log("Server response:", response);
                    resolve(JSON.stringify(response));
                } catch (e) {
                    resolve(JSON.stringify({
                        err_code: "99",
                        err_msg: "Invalid / partial JSON received",
                        raw_length: message.length
                    }));
                }
            }
        };

        this.client.on("data", onData);

        this.client.on("error", (err) => {
            this.client.off("data", onData);
            resolve(JSON.stringify({
                err_code: "9",
                err_msg: err.message
            }));
        });
        this.client.write(jsonRequest + "\n");
    });
}



    // Disconnect from the agent
    disconnectAgent() {
        return new Promise((resolve) => {
            if (!this.connected) {
                console.log("Already disconnected.");
                resolve(true);
                return;
            }

            const jsonRequest = JSON.stringify({
                password: this.encodePassword(this.PASSWORD),
                action: "agent.disconnect"
            });

            this.client.write(jsonRequest + '\n');

            this.client.once('data', (data) => {
                const response = JSON.parse(data.toString().trim());
                console.log("Server response (disconnect):", response);

                this.client.end(() => {
                    this.connected = false;
                    resolve(response.err_code === "0");
                });
            });

            this.client.on('error', (err) => {
                console.error("Error during disconnect:", err.message);
                resolve(false);
            });
        });
    }
}

module.exports = {DbSrcAgentClient};



// Example usage of DbSrcAgentClient full workflow

(async () => {
    const client = new DbSrcAgentClient();

    // Step 1: Connect to agent
    const isConnected = await client.connectAgent();
    if (!isConnected) {
        console.error("❌ Failed to connect to agent.");
        return;
    }
    console.log("✅ Connected to agent!");

    try {
        // Step 2: Validate DBSRC user
        let response = await client.sendMessage('validate.password.dbsrc.user.ivan.Rc3e4745c$4');

        // Parse if needed
        if (typeof response === 'string') {
            try {
                response = JSON.parse(response);
            } catch (err) {
                console.error("❌ Failed to parse response JSON:", response);
                return;
            }
        }


        

        // Step 3: Extract token
        let token = null;
        if (response && String(response.err_code) === '0' && response.token) {
            token = response.token;
            console.log("🔑 Token retrieved:", token);

            // Step 4: Connect to ACCP schema
            const connectCommand = `connect.accp.345.${token}.ivan.127.0.0.1`;
            console.log("🔗 Sending connect command:", connectCommand);

            let connectResp = await client.sendMessage(connectCommand);
            if (typeof connectResp === 'string') {
                try { connectResp = JSON.parse(connectResp); } catch {}
            }
            console.log("Server response (connect):", connectResp);


            await client.sendMessage('show.dbsrc.user.accp.access.ivan');

            // Verify connection success
            if (connectResp && String(connectResp.err_code) === '0') {
                console.log("✅ Connected to ACCP schema.");

                // Step 5: Execute SQL (multiline supported)
                const sqlCommand = `sql.[
SELECT SUM(total) AS total_sum, "OPERATION NAME"
  FROM scal_live.all_oper_stats 
 WHERE "DOCTOR ID" = 702
   AND year = 2023
 GROUP BY "OPERATION NAME"
]`;
                console.log("🧮 Sending SQL command...");

                let sqlResponse = await client.sendMessage(sqlCommand);
                if (typeof sqlResponse === 'string') {
                    try { sqlResponse = JSON.parse(sqlResponse); } catch {}
                }
                console.log("Server response (sql):", sqlResponse);

                // Step 6: Disconnect from ACCP
                const disconnectCommand = `disconnect.accp`;
                console.log("🔌 Sending disconnect command:", disconnectCommand);

                let disconnectResp = await client.sendMessage(disconnectCommand);
                if (typeof disconnectResp === 'string') {
                    try { disconnectResp = JSON.parse(disconnectResp); } catch {}
                }
                console.log("Server response (disconnect):", disconnectResp);

                if (disconnectResp && String(disconnectResp.err_code) === '0') {
                    console.log("✅ Disconnected from ACCP schema successfully.");
                } else {
                    console.error("⚠ Disconnect failed:", disconnectResp);
                }
            } else {
                console.error("❌ Failed to connect to ACCP schema:", connectResp);
            }
        } else {
            console.error("❌ Failed to validate user or no token found:", response);
        }

    } catch (error) {
        console.error("❌ Unexpected error occurred:", error);
    } finally {
        // Always disconnect from the agent
        const isDisconnected = await client.disconnectAgent();
        console.log("Agent disconnected:", isDisconnected);
    }
})();
