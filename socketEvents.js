module.exports = io => {
  const chat = io.of("/chat").clients((error, clients) => {
    if (error) {
      console.log({ error, clients });
    }
  });

  chat.on("connection", socket => {
    let channelId;

    const req = socket.request;
    const { headers: { referer } } = req;
    const { headers: { origin } } = req;
    const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    // console.log("referer:", referer);
    // console.log("socket rooms:", socket.rooms);
    if (referer) {
      channelId = referer
        .split("/")
        [referer.split("/").length - 1].replace(/\?.+/, "");

      socket.join(channelId, () => {
        let rooms = Object.keys(socket.rooms);
        // console.log("rooms", rooms);
      });
    }

    socket.on("send_message", message => {
      // console.log(message);
      if (message.channel) {
        if (message.type === "join") {
          // console.log("join");

          let userCount = socket.adapter.rooms[message.channel].length;
          socket.to(message.channel).emit("userCountUpdate", userCount);
        } else if (message.type === "disconnect") {
        }

        // setTimeout(() => {
        //   message.time = getClock();
        //   socket.to(message.channel).emit("update_message", message);
        // }, 10);
        message.time = getClock();
        socket.to(message.channel).emit("update_message", message);
      } else {
        console.log("broadcast!!");
        console.log(message);
        message.time = getClock();
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
      // console.log("leaved:", data.channel, data.username);
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

    // Util
    const getClock = () => {
      let time = new Date();
      let hour = time.getHours();
      let minute = time.getMinutes();
      let second = time.getSeconds();
      let ampm = hour > 12 ? "오후 " : "오전 ";
      let temp = ampm + "" + (hour > 12 ? hour - 12 : hour);
      if (hour == 0) temp = "12";
      temp += (minute < 10 ? ":0" : ":") + minute;
      return temp;
    };
  });
};
