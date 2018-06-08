// Copyright 2018 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var url = require('url');
var http = require('http');
var jwt = require('jsonwebtoken');

function getJwtInHeader(request) {
  return request.headers['authorization'];
}

// jwtPlaintextKey - Encryption key to verify jwt
// opts.hostname   - Hostname of running server used to address this target
// port            - Port of running target
module.exports = function(jwtPlaintextKeys, hostnames, port) {
  if (typeof hostnames === 'string') {
    hostnames = [hostnames];
  }

  return function(server) {

    var verifyToken = function(key, text) {
      try {
        var token = jwt.verify(text, key);
        var location = url.parse(token.location);
        
        // Make sure token location matches this target
        if (hostnames.indexOf(location.hostname) === -1 || location.port !== port) {
          return false;
        }
      } catch(err) {
        return false;
      }

      return true;
    };
    
    // HTTP Requests
    server.httpServer.cloud.use(function(handle) {
      handle('request', function(env, next) {
        var cipher = null;
        if (getJwtInHeader(env.request)) {
          cipher = getJwtInHeader(env.request);
        } else {
          // Check url param
          var parsed = url.parse(env.request.url, true);
          cipher = parsed.query.jwt;
        }

        if (!cipher || !verifyToken(jwtPlaintextKeys.internal, cipher)) {
          env.response.statusCode = 401;
          env.response.end();
          return;
        }

        next(env);
      });
    });
    
    
    // On Websocket connection
    server.httpServer.onEventWebsocketConnect(function(request, socket, head, next) {
      var cipher = null;
      
      // Check header
      if (getJwtInHeader(request)) {
        cipher = getJwtInHeader(request);
      } else {
        // Check url param
        var parsed = url.parse(request.url, true);
        cipher = parsed.query.jwt;
      }

      if(!cipher || !verifyToken(jwtPlaintextKeys.internal, cipher)) {
        httpResponse(socket, 401);
      } else {
        next();
      }
    });
    
    // Peer connection
    server.httpServer.onPeerConnect(function(request, socket, head, next) {
      var parsed = url.parse(request.url, true);

      if (!parsed.query.jwt) {
        httpResponse(socket, 401);
        return;
      }

      if(!verifyToken(jwtPlaintextKeys.external, parsed.query.jwt)) {
        httpResponse(socket, 401);
      } else {
        next();
      }
    })
  };
}

function httpResponse(socket, code) {
  var responseLine = 'HTTP/1.1 ' + code + ' ' + http.STATUS_CODES[code] + '\r\n\r\n\r\n';
  socket.end(responseLine);
}
