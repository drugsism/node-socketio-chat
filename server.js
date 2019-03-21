const express = require("express");
const path = require("path");
const https = require("https");
const http = require("http");
const app = express();
const cors = require("cors");
const redis = require("redis");
const fs = require("fs");
const axios = require("axios");
require("dotenv").config();

app.set("port", process.env.LIVESOCKET_PORT || 6262);
app.use(cors());
process.on("uncaughtException", function(err) {
  console.log(err);
});

let server;
if (process.env.APP_ENV === "dev") {
  var options = {
    pingInterval: 10000,
    pingTimeout: 60000,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 99999
  };
  server = http.createServer(options, app).listen(app.get("port"), () => {
    console.log("listening for Livechat port:", app.get("port"));
  });
} else {
  var options = {
    ca: fs
      .readFileSync(path.resolve("/etc/apache2/cert/modootraining.co.kr.root"))
      .toString(),
    key: fs
      .readFileSync(path.resolve("/etc/apache2/cert/modootraining.co.kr.key"))
      .toString(),
    cert: fs
      .readFileSync(path.resolve("/etc/apache2/cert/modootraining.co.kr.crt"))
      .toString(),
    pingInterval: 10000,
    pingTimeout: 60000,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 99999
  };
  server = https.createServer(options, app).listen(app.get("port"), () => {
    console.log("listening for Livechat port:", app.get("port"));
  });
}

const channel_state = {
  // channelId: {
  //   channelName: "Test Channel",
  //   userCount: 0,
  //   ownerName: "Enfit"
  // }
};

const io = require("socket.io").listen(server, options);
const chat = io.of("/chat");

io.of("/chat").clients((error, clients) => {
  if (error) throw error;
  console.log("clients: ", clients);
});

chat.on("connection", function(socket) {
  let channelId;

  const req = socket.request;
  const { headers: { referer } } = req;
  const { headers: { origin } } = req;
  const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  console.log("referer:", referer);
  if (referer) {
    channelId = referer
      .split("/")
      [referer.split("/").length - 1].replace(/\?.+/, "");

    socket.join(channelId, function() {
      let rooms = Object.keys(socket.rooms);
      console.log(rooms);
    });
  }

  // 클러스터링
  // REDIS가 필요한 경우
  // const redisClient = redis.createClient();
  // redisClient.subscribe('chat_message');

  // redisClient.on("message", function (channel, message) {
  //     let chat_message = JSON.parse(message);
  //     // if (!chat_message.channel) {
  //     //     socket.emit(channel, message);
  //     // } else {
  //     //     // socket.in(chat_message.channel).emit(channel, message);
  //     //     socket.to(chat_message.channel).emit('update_message', message);
  //     // }
  //     // console.log('message to ', chat_message.channel, ' - ', message);
  // });
  socket.on("send_message", function(message) {
    console.log(socket.id);
    console.log(socket.name);
    if (message.channel) {
      if (message.type === "join") {
        console.log("join");

        let userCount = socket.adapter.rooms[message.channel].length;
        socket.to(message.channel).emit("userCountUpdate", userCount);
      } else if (message.type === "disconnect") {
      }

      setTimeout(function() {
        socket.to(message.channel).emit("update_message", message);
      }, 10);
    } else {
      console.log("broadcast!!");
      console.log(message);
      socket.broadcast.emit("update_message", message);
    }
  });

  socket.on("liveEnd", function(channel) {
    console.log("Live End: ", channel.channel);
    socket.to(channel.channel).emit("liveUserEnd");
  });

  socket.on("createLive", function(channel) {
    socket.join(channel);
  });

  let disconnectUserName = "";
  socket.on("getUserCount", function(channel) {});
  socket.on("leaveChannel", function(data) {
    console.log("leaved:", data.channel, data.username);
    socket.to(data.channel).emit("debug", socket.id);
    disconnectUserName = data.username;
  });

  socket.on("disconnect", function(reason) {
    if (channelId) {
      if (disconnectUserName != "") {
        socket.to(channelId).emit("update_message", {
          name: "system",
          body: disconnectUserName + "님이 퇴장하셨습니다.",
          channel: channelId,
          type: "disconnect"
        });
      }

      if (socket.adapter.rooms[channelId]) {
        let userCount = socket.adapter.rooms[channelId].length;
        socket.to(channelId).emit("userCountUpdate", userCount);
        socket.leave(channelId, function() {});
      }
    } else {
    }

    // redisClient.quit();
    // redisClient.end();
  });

  socket.on("forceDisconnect", function() {
    socket.disconnect();
  });

  socket.on("reconnect", function(nr) {
    console.log("reconnected, nr: ", nr);
  });

  socket.on("error", function() {
    console.log(error);
  });
});
