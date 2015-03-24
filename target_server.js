var zetta = require('zetta');
var MemoryPeerRegistry = require('./memory_peer_registry');
var MemoryRegistry = require('./memory_registry');
var ServiceRegistry = require('./service_registry');

var port = process.env.MAPPED_PORT || 3001;
var version = process.env.VERSION || '0';
var UsageApp = require('zetta-usage-addon');
var UsageCollector = require('./sqs_collector');

var app = new UsageApp()

var opts = {
  queueUrl: process.env.QUEUE_URL,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  collector: app
}
Collector(app);

var options = {
  host: process.env.COREOS_PRIVATE_IPV4
};

var peerRegistry = new MemoryPeerRegistry();

var serviceRegistryClient = new ServiceRegistry(options);

var instance = zetta({
  registry: new MemoryRegistry(), // no device registry is needed
  peerRegistry: peerRegistry
});

instance.use(app.collect());

instance.name('cloud-' + port);

var instanceUrl = 'http://' + process.env.COREOS_PRIVATE_IPV4 + ':' + port;

instance.httpServer.server.on('close', function() {
  serviceRegistryClient.remove('cloud-target', instanceUrl);
  clearInterval(timer);
});

var timer = null;
instance.listen(port, function() {
  serviceRegistryClient.add('cloud-target', instanceUrl, version);
  timer = setInterval(function() {
    serviceRegistryClient.add('cloud-target', instanceUrl, version);
  }, 60000);
});

['SIGINT', 'SIGTERM'].forEach(function(signal) {
  process.on(signal, function() {
    clearInterval(timer);
    serviceRegistryClient.remove('cloud-target', instanceUrl, function() {
      process.exit();
    });
  });
});
