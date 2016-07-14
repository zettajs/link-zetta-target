// Update ETCD with hubs routing info

module.exports = function(serverUrl, routerClient, serviceRegistryClient) {
  return function(server) {

    var _tenantId = null;
    var _lastTenantIdUpdate = 0;
    var _tenantIdCacheTime = 30000; //30s
    
    function getTenantId(callback) {
      if (!_tenantId || new Date().getTime() - _lastTenantIdUpdate > _tenantIdCacheTime) {
        serviceRegistryClient.get(serverUrl, function(err, result) {
          if (err) {
            return callback(err);
          }

          if (result.tenantId) {
            _tenantId = result.tenantId;
            _lastTenantIdUpdate = new Date().getTime();
            return callback(null, _tenantId);
          } else {
            return callback(new Error('TenantId not set for server.'));
          }
        });
      } else {
        setImmediate(function() {
          callback(null, _tenantId);
        });
      }
    }
    
    function updatePeer(peer, callback) {
      getTenantId(function(err, tenantId) {
        if (err) {
          server.error('Routing Updater failed to get tenantId. ' + err.message);
          return callback(err);
        }

        routerClient.add(tenantId, peer.name, 'http://' + serverUrl, callback);
      });
    }

    function removePeer(peer, callback) {
      getTenantId(function(err, tenantId) {
        if (err) {
          server.error('Routing Updater failed to get tenantId. ' + err.message);
          return callback(err);
        }
        
        routerClient.remove(tenantId, peer.name, function(err) {
          if (err && err.errorCode !== 100) {
            return callback(err);
          } else {
            return callback();
          }
        });
      });
    }

    this._updateTimer = setInterval(function() {
      // Reset ttl on all connected hubs
      var peers = Object.keys(server.httpServer.peers).map(function(k) {
        return server.httpServer.peers[k];
      }).filter(function(peer) {
        return peer.state === 2; // CONNECTED https://github.com/zettajs/zetta/blob/master/lib/peer_socket.js#L14
      }).forEach(function(peer) {
        updatePeer(peer, function(err) {
          if (err) {
            server.error('Failed to update peer "'+ peer.name +'" in router. ' + err.message);
            return;
          }
        })
      })
      
    }, routerClient._ttl / 3 * 1000); // 1/3 the ttl length
    
    
    server.pubsub.subscribe('_peer/connect', function(topic, data) {
      updatePeer(data.peer, function(err) {
        if (err) {
          server.error('Failed to update peer "'+ data.peer.name +'" in router. ' + err.message);
          return;
        }
      })
    });
    
    server.pubsub.subscribe('_peer/disconnect', function(topic, data) {
      removePeer(data.peer, function(err) {
        if (err) {
          server.error('Failed to remove peer "'+ data.peer.name +'" from router. ' + err.message);
          return;
        }
      })
    });


    ['SIGINT', 'SIGTERM'].forEach(function(signal) {
      process.once(signal, function() {
        server.log('Shutting down, removing all peers from router.')

        // Reset ttl on all connected hubs
        var peers = Object.keys(server.httpServer.peers).map(function(k) {
          return server.httpServer.peers[k];
        }).filter(function(peer) {
          return peer.state === 2; // CONNECTED https://github.com/zettajs/zetta/blob/master/lib/peer_socket.js#L14
        });

        var count = peers.length;
        if (count === 0) {
          process.exit();
        }

        peers.forEach(function(peer) {
          removePeer(peer, function(err) {
            count--;
            if (count === 0) {
              process.exit();
            }
          });
        });
      });
    });

  };
}
