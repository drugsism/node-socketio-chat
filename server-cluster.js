const express = require("express"),
  cluster = require("cluster"),
  net = require("net"),
  socketIO = require("socket.io"),
  socketIO_redis = require("socket.io-redis");

const port = 6262,
  num_processes = require("os").cpus().length;

if (cluster.isMaster) {
  const workers = [];

  const spawn = i => {
    workers[i] = cluster.fork();

    workers[i].on("exit", function(code, signal) {
      console.log("respawning worker", i);
      spawn(i);
    });
  };

  // Spawn workers
  for (let i = 0; i < num_processes; i++) {
    spawn(i);
  }

  let worker_index = (ip, len) => {
    let s = "";
    for (let i = 0; i < ip.length; i++) {
      if (!isNaN(ip[i])) {
        s += ip[i];
      }
    }
    return Number(s) % len;
  };

  const server = net
    .createServer({ pauseOnConnect: true }, connection => {
      let worker =
        workers[worker_index(connection.remoteAddress, num_processes)];
      // console.dir(worker.send.toString());

      worker.send("sticky-session:connection", connection);
    })
    .listen(port);
} else {
  const app = express();

  // use middleware

  const server = app.listen(0, "localhost", () => {
      console.log("Worker is listening for Livechat port:", port);
    }),
    io = socketIO(server);

  // Socket.io Events required
  require("./socketEvents")(io);

  io.adapter(socketIO_redis({ host: "localhost", port: 6379 }));

  // Socket.IO middleware for authorization etc.

  // Listen to messages sent from the master. Ignore everything else.
  process.on("message", (message, connection) => {
    // console.log("connection", connection);
    if (message !== "sticky-session:connection") {
      return;
    }

    // Emulate a connection event on the server by emitting the
    // event with the connection the master sent us.
    server.emit("connection", connection);

    connection.resume();
  });
}
