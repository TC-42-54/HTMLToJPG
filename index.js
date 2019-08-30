'use strict';
var pp = require('puppeteer');
var fs = require('fs');
var http = require('http');
var fs = require('fs');
var mime = require('mime');
var io;
var server;
var routes = {};
var users = [];
var pages = {};
var globalBrowser;
var options = {
  args: ['--no-sandbox', '--disable-gpu', '--disable-setuid-sandbox'],
  headless: true
};
console.log(options);
pp.launch(options).then(browser => {
  console.log("chromium launched");
  globalBrowser = browser;
  process.on('exit', function() {
    var proc = process;
    globalBrowser.close().then(closed => {
      console.log("browser closed");
      proc.exit();
    }).catch(err => console.error(err));
  });
  process.on('SIGTERM', function() {
    var proc = process;
    globalBrowser.close().then(closed => {
      console.log("browser closed");
      proc.exit();
    }).catch(err => console.error(err));
  });
  process.on('SIGINT', function() {
    var proc = process;
    globalBrowser.close().then(closed => {
      console.log("browser closed");
      proc.exit();
    }).catch(err => console.error(err));
  });
}).catch(err => console.error(err));


function base64ArrayBuffer(arrayBuffer) {
  var base64    = ''
  var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  var bytes         = new Uint8Array(arrayBuffer)
  var byteLength    = bytes.byteLength
  var byteRemainder = byteLength % 3
  var mainLength    = byteLength - byteRemainder
  var a, b, c, d
  var chunk
  for (var i = 0; i < mainLength; i = i + 3) {
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]
    a = (chunk & 16515072) >> 18
    b = (chunk & 258048)   >> 12
    c = (chunk & 4032)     >>  6
    d = chunk & 63
    base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
  }
  if (byteRemainder == 1) {
    chunk = bytes[mainLength]
    a = (chunk & 252) >> 2
    b = (chunk & 3)   << 4
    base64 += encodings[a] + encodings[b] + '=='
  } else if (byteRemainder == 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]
    a = (chunk & 64512) >> 10
    b = (chunk & 1008)  >>  4
    c = (chunk & 15)    <<  2
    base64 += encodings[a] + encodings[b] + encodings[c] + '='
  }
  return base64
}

const takeScreenShot = (idx, user, args) => {
  setTimeout(function() {
    if (typeof pages[user.id] !== "undefined")
    pages[user.id].screenshot({type: 'png', clip: {
      x: 0,
      y: 0,
      width: parseInt(args.w),
      height : parseInt(args.h)
    }}).then(shot => {
      user.emit('shot', {
        index: idx,
        shot: shot
      });
    }).catch(err => console.error(err));
  }, (idx * 300));
}

const registerRoute = (url, func) => {
  routes[url] = func;
}
registerRoute('/', (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/html');
    res.write(fs.readFileSync(__dirname + '/index.html'));
    res.statusCode = 200;
    res.end();
  } catch(e) {
    res.statusCode = 500;
    res.statusMessage = "server error";
    res.end();
  }
});

registerRoute('public', (req, res) => {
  res.setHeader('Content-Type', mime.getType(req.url));
  if (fs.existsSync(__dirname + req.url)) {
    res.write(fs.readFileSync(__dirname + req.url));
    res.statusCode = 200;
  } else {
    res.statusCode = 404;
  }
  res.end();
});

registerRoute('404', (req, res) => {
  res.statusCode = 404;
  res.statusMessage = 'Route is not set.';
  res.end();
});

io = require('socket.io')(server = http.createServer(function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (typeof routes[req.url] !== "undefined") {
      routes[req.url](req, res);
  } else {
    routes['public'](req, res);
    res.end();
  }
}));

io.on('connection', u => {
  users.push(u.id);
  u.on('start', args => {
    var _user = u;
    globalBrowser.newPage().then(page => {
      pages[_user.id] = page;
      pages[_user.id].goto(args.url).then(loaded => {
        for(var i = 1; i < 51; i++) {
            takeScreenShot(i, _user, args);
        }
      }).catch(err => console.error(err));
    });
  });
  u.on('finished', () => {
    if (typeof pages[u.id] !== "undefined") {
      pages[u.id].close(ret => {
        pages[u.id] = undefined;
      });
    }
  });
  u.on('disconnect', () => {
    if (typeof pages[u.id] !== "undefined") {
      pages[u.id].close(ret => {
        pages[u.id] = undefined;
      });
    }
    users = users.filter(e => (e === u.id));
  });
});

if (typeof process.env.PORT === "undefined") {
  process.env.PORT = 8080;
}
server.listen(process.env.PORT);
