const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const client = require('./pool/client.js');

const PORT = process.env.PORT || 8000;

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.setMaxListeners(Number.MAX_SAFE_INTEGER);
io.on('connection', (socket) => {
  socket.setMaxListeners(Number.MAX_SAFE_INTEGER);
  
  let clients = {};
  let uid = socket.id;

  socket.emit('can start');

  // Connecteced
  socket.on('start', (params) => {
    const { worker_name, stratum, version, algo } = params;
    const worker = worker_name || stratum.worker;
    clients[worker] = client({
      version,
      algo,
      ...stratum,
      autoReconnectOnError: true,
      onConnect: () => console.log('Connected to server'),
      onClose: () => console.log('Connection closed'),
      onError: (error) =>  {
        console.log('Error', error.message)
        socket.emit('error', error.message);
      },
      onNewDifficulty: (newDiff) => {
        console.log('New difficulty', newDiff)
        socket.emit('difficult', newDiff);
      },
      onSubscribe: (subscribeData) => console.log('[Subscribe]', subscribeData),
      onAuthorizeSuccess: () => console.log('Worker authorized'),
      onAuthorizeFail: () => {
        socket.emit('error', 'WORKER FAILED TO AUTHORIZE');
      },
      onNewMiningWork: (work) => {
        socket.emit('work', [worker, work]);
      },
      onSubmitWorkSuccess: (error, result) => {
        socket.emit('shared', { error, result });
      },
      onSubmitWorkFail: (error, result) => {
        socket.emit('submit failed', { error, result });
      },
    });
  });

  // Worker submit work
  socket.on('submit', (work) => {
    const client = clients[work.worker_name];
    if (!client) return;
    client.submit(work);
  });

  // Worker submit work
  socket.on('hashrate', (hashrate) => {
    // console.log(hashrate);
  });

  // disconnect
  socket.on("disconnect", (reason) => {
    Object.values(clients).forEach(o => o.shutdown());
    clients = {};
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
