var zetta = require('zetta');
var MemoryPeerRegistry = require('./memory_peer_registry');
var MemoryRegistry = require('./memory_registry');
var DeviceDataSqs = require('zetta-device-data-sqs');
var UsageApp = require('zetta-usage-addon');
var UsageCollector = require('./sqs_collector');
var port = process.env.MAPPED_PORT || 3001;
var version = process.env.VERSION || '0';

var app = new UsageApp()

var instance = zetta({
  registry: new MemoryRegistry(), // no device registry is needed
  peerRegistry: new MemoryPeerRegistry()
});

instance.use(app.collect());

instance.name('cloud-' + port);

if (process.env.DEVICE_DATA_QUEUE) {
  var sqs = new DeviceDataSqs({
    queueUrl: process.env.DEVICE_DATA_QUEUE,
    accessKeyId: process.env.AWS_ACCESSKEY,
    secretAccessKey: process.env.AWS_SECRET
  });

  instance.use(sqs.collect());
}

if (process.env.ZETTA_USAGE_QUEUE) {
  var opts = {
    queueUrl: process.env.ZETTA_USAGE_QUEUE,
    accessKeyId: process.env.AWS_ACCESSKEY,
    secretAccessKey: process.env.AWS_SECRET,
    emitter: app
  }
  UsageCollector(opts);
}

instance.listen(port);


