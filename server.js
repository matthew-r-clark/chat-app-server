const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const port = process.env.PORT || 4001;
const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "https://mclark-chat-app.netlify.app/",
    methods: ["GET", "POST"]
  }
});


app.get("/", (req, res) => {
  res.sendStatus(200);
});


let online = [];
function getUsernameById(id) {
  let user = getUserById(id);
  if (user) {
    return user.username;
  }
}

function getUserById(id) {
  let user = online.filter(u => u.id === id)[0];
  return user;
}

function getIdByUsername(name) {
  let user = getUserByUsername(name);
  if (user) {
    return user.id;
  }
}

function getUserByUsername(username) {
  let user = online.filter(u => u.username === username)[0];
  return user;
}

io.on('connection', socket => {
  socket.on('join chat', data => {
    if (!data || !data.username) {
      socket.emit('invalid name', 'Please enter a valid username (must be at least one character):');
    } else if (getUserByUsername(data.username)) {
      socket.emit('invalid name', 'Username is already taken, try again:');
    } else {
      let status = { sender: data.username, message: data.username + ' has joined the chat'};
      socket.broadcast.emit('user status', status);
      online.push({id: socket.id, username: data.username});
      online.sort(alphaSortOnline);
    }
  });

  socket.on('typing', data => {
    let sender = getUsernameById(socket.id);
    let chat = data.chat === 'General' ? data.chat : sender;

    let payload = {
      sender: sender,
      chat: chat
    };

    if (data.chat === 'General') {
      socket.broadcast.emit('users typing', payload);
    } else {
      let recipientId = getIdByUsername(data.chat);
      socket.to(recipientId).emit('users typing', payload);
    }
  });

  socket.on('chat message', incomingMessage => {
    let senderName = getUsernameById(socket.id);
    let recipientId = getIdByUsername(incomingMessage.recipient);
    let outgoingMessage = {
      sender: senderName,
      text: incomingMessage.text,
      recipient: incomingMessage.recipient,
    };

    ['chat message', 'update badges'].forEach(emitType => {
      socket.emit(emitType, outgoingMessage);
      if (recipientId) {
        socket.to(recipientId).emit(emitType, outgoingMessage);
      } else {
        socket.broadcast.emit(emitType, outgoingMessage);
      }
    });
  });

  socket.on('disconnect', () => {
    let username = getUsernameById(socket.id);
    if (username) {
      online.remove(getUserById(socket.id));
      let status = { sender: username, message: username + ' has left the chat'};
      socket.broadcast.emit('user status', status);
    }
  });

  setInterval(() => {
    if (getUsernameById(socket.id)) {
      socket.emit('online', {online: online});
    }
  }, 1000);
});

server.listen(port, () => console.log(`Listening on port ${port}`));

function alphaSortOnline(a, b) {
  a = a.username;
  b = b.username;
  if (a < b) {
    return -1;
  } else if (a > b) {
    return 1;
  } else {
    return 0;
  }
}

if (!Array.prototype.remove) {
  Array.prototype.remove = function(item) {
    let index = this.indexOf(item);
    if (index >= 0) {
      this.splice(index, 1);
    }
    return this;
  }
}