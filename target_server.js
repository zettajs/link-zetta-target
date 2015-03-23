var zetta = require('zetta');
var MemoryPeerRegistry = require('./memory_peer_registry');
var MemoryRegistry = require('./memory_registry');

var port = process.env.MAPPED_PORT || 3001;

var instance = zetta({
  registry: new MemoryRegistry(), // no device registry is needed
  peerRegistry: new MemoryPeerRegistry()
});

instance.name('cloud-' + port);

instance.listen(port);
