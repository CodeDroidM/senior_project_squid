// server.js
const express = require('express');
const bodyParser = require('body-parser');
const { DbSrcAgentClient } = require('./dbSrcAgentClient.js'); // your existing agent client

const app = express();
const port = 3000;
app.use(bodyParser.json());
app.use(express.static('public')); // serve HTML from /public folder

let client = null;
let token = null;

app.post('/api/connect', async (req, res) => {
  try {
    client = new DbSrcAgentClient();
    const connected = await client.connectAgent();
    if (!connected) return res.status(500).json({ error: 'Failed to connect to DbSrc agent' });

    // 1️⃣ Get token
    const validateResp = await client.sendMessage('validate.password.dbsrc.user.ivan.Rc3e4745c$4');
    const resp = JSON.parse(validateResp);
    if (resp.err_code !== "0" || !resp.token) {
      return res.status(401).json({ error: 'Invalid credentials or no token' });
    }

    token = resp.token;

    // 2️⃣ Connect ACCP with token
    const connectCommand = `connect.accp.345.${token}.ivan.127.0.0.1`;
    const accpRespRaw = await client.sendMessage(connectCommand);
    const accpResp = JSON.parse(accpRespRaw);

    if (accpResp.err_code !== "0") {
      return res.status(500).json({
        error: 'Failed to connect ACCP',
        details: accpResp
      });
    }

    res.json({
      message: 'Connected successfully to ACCP and DbSrc agent',
      token,
      accp_response: accpResp
    });
  } catch (err) {
    console.error('Connection error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/agentMessage', async (req, res) => {
  if (!client || !client.connected) return res.status(400).json({ error: 'Agent not connected' });

  const { action } = req.body;
  if (!action) return res.status(400).json({ error: 'Missing action string' });

  try {
    const response = await client.sendMessage(action);
    res.json(JSON.parse(response));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



app.post('/api/sql', async (req, res) => {
  if (!client || !client.connected) return res.status(400).json({ error: 'Not connected' });
  const { queries } = req.body;

  try {
    const results = [];
    for (const query of queries) {
      const sqlCommand = `sql.[${query}]`;
      const response = await client.sendMessage(sqlCommand);
      results.push(JSON.parse(response));
    }
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/disconnect', async (req, res) => {
  if (!client) return res.json({ message: 'Already disconnected' });
  await client.sendMessage('disconnect.accp');
  await client.disconnectAgent();
  client = null;
  token = null;
  res.json({ message: 'Disconnected from agent' });
});



// New: direct agent connect route
app.post('/api/connectAgent', async (req, res) => {
  try {
    if (client && client.connected) {
      return res.json({ err_code: "0", err_msg: "Already connected to agent" });
    }

    client = new DbSrcAgentClient();
    const success = await client.connectAgent();

    if (success) {
      res.json({ err_code: "0", err_msg: "Agent connected successfully" });
    } else {
      res.json({ err_code: "1", err_msg: "Failed to connect to agent" });
    }
  } catch (error) {
    console.error("Error connecting to agent:", error.message);
    res.status(500).json({ err_code: "-1", err_msg: "Agent connection error: " + error.message });
  }
});


// New: direct agent disconnect route
app.post('/api/disconnectAgent', async (req, res) => {
  try {
    if (!client || !client.connected) {
      return res.json({ err_code: "0", err_msg: "Already disconnected" });
    }

    const success = await client.disconnectAgent();

    if (success) {
      client = null;
      res.json({ err_code: "0", err_msg: "Agent disconnected successfully" });
    } else {
      res.json({ err_code: "1", err_msg: "Error disconnecting agent" });
    }
  } catch (error) {
    console.error("Error disconnecting agent:", error.message);
    res.status(500).json({ err_code: "-1", err_msg: "Agent disconnect error: " + error.message });
  }
});


app.listen(port, () => {
  console.log(`🚀 DbSrc Demo Server running at http://localhost:${port}`);
});
