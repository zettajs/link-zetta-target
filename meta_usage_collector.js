var url = require('url');

// collect usage meta data
module.exports = function(config) {
  var client = config.client;
  var serviceRegistryClient = config.serviceRegistryClient;
  var tenantId = null;
  var tenantIdTimer = null;
  var _pendingGetTennatId = false;
  
  return function(runtime) {

    var getTenantId = function() {
      if (_pendingGetTennatId || tenantId !== null) {
        return;
      }
      _pendingGetTennatId = true;
      serviceRegistryClient.get(config.serverUrl, function(err, result) {
        _pendingGetTennatId = false;
        if (err) {
          console.error(err);
          return;
        }
        
        if (result.tenantId) {
          tenantId = result.tenantId;
          clearInterval(tenantIdTimer);
        }
      });
    };
    tenantIdTimer = setInterval(getTenantId, 30000);

    runtime.httpServer.cloud.use(function(handle) {
      handle('response', function(env, next) {
        if (tenantId === null) {
          return next(env);
        }
        
        // Dont record 500 error codes
        if (env.response.statusCode >= 500 && env.response.statusCode < 600) {
          return next(env);
        }

        var parsed = url.parse(env.request.url, true);

        // Record device query requests
        if (parsed.pathname === '/' && parsed.query.ql) {
          var servers = [];
          if (parsed.query.server === '*') {
            Object.keys(runtime.httpServer.peers).forEach(function(targetName) {
              // Only record requests going to connected peers
              if (runtime.httpServer.peers[targetName] && runtime.httpServer.peers[targetName].state === 2) {
                servers.push(targetName);
              }
            });
          } else {
            servers = [parsed.query.server];
          }
          // Record device queries
          servers.forEach(function(targetName) {
            client.increment('linkusage.hub.http.count', { tenantId: tenantId, targetName: targetName, reqType: 'device-query' });
          });
        } else {
          var match = /^\/servers\/(.+)$/.exec(env.request.url);
          if (match) {
            var targetName = decodeURIComponent(/^\/servers\/(.+)$/.exec(parsed.pathname)[1].split('/')[0]);

            client.increment('linkusage.hub.http.count', { tenantId: tenantId, targetName: targetName, reqType: 'proxy'});
          }
        }

        next(env);
      });
    });
    
    var peers = [];
    runtime.pubsub.subscribe('_peer/connect', function(ev, msg) {
      if (peers.indexOf(msg.peer.name) < 0) {
        peers.push(msg.peer.name);
        getTenantId();

        // Log number of spdy pings sent
        var ping = msg.peer.agent.ping;
        msg.peer.agent.ping = function() {
          if (tenantId !== null) {
            client.increment('linkusage.hub.spdypings.count', { tenantId: tenantId, targetName: msg.peer.name});
          }
          ping.apply(msg.peer.agent, arguments);
        };

        // Log number of subscribe/unsubscribe requests are proxied to hub
        ['subscribe', 'unsubscribe', 'transition'].forEach(function(func) {
          var origFunc = msg.peer[func];
          msg.peer[func] = function() {
            if (tenantId !== null) {
              client.increment('linkusage.hub.http.count', { tenantId: tenantId, targetName: msg.peer.name, reqType: func });
            }
            origFunc.apply(msg.peer, arguments);
          }
        });
        
        // Record peer connect/error/end events
        ['connected', 'error', 'end'].forEach(function(event) {
          msg.peer.on(event, function() {
            if (tenantId !== null) {
              client.increment('link.targets.hub.' + event, { tenantId: tenantId, targetName: msg.peer.name});
            }
          });
        });

        // Record all messages sent from hub
        msg.peer.on('zetta-events', function(topic, data) {
          if (!data.topic || tenantId === null) {
            return;
          }

          var split = data.topic.split('/');

          // linkusage.hub.messages
          var sendData = {
            tenantId: tenantId,
            targetName: msg.peer.name,
            topic: data.topic
          };

          // Device data events that conform to {type}/{id}/{stream}
          if (split.length === 3) {
            sendData.deviceType = split[0];
            sendData.device = split[1];
            sendData.stream = split[2];
          }

          var dataBytes = 0;
          if (data.data) {
            try {
              dataBytes = JSON.stringify(data.data).length
            } catch (err) {
              return;
            }
          }

          client.increment('linkusage.hub.messages.count', sendData);
          client.count('linkusage.hub.messages.bytes', dataBytes, sendData);
        });
      }
    });
    
  };
};

