var zetta = require('zetta');
var MemoryPeerRegistry = require('./memory_peer_registry');
var MemoryRegistry = require('./memory_registry');
var DeviceDataSqs = require('zetta-device-data-sqs');

var port = process.env.MAPPED_PORT || 3001;

var instance = zetta({
  registry: new MemoryRegistry(), // no device registry is needed
  peerRegistry: new MemoryPeerRegistry()
});

instance.name('cloud-' + port);

if (process.env.DEVICE_DATA_QUEUE) {
  var sqs = new DeviceDataSqs({
    queueUrl: process.env.DEVICE_DATA_QUEUE,
    accessKeyId: process.env.AWS_ACCESSKEY,
    secretAccessKey: process.env.AWS_SECRET
  });

  instance.use(sqs.collect());
}

instance.listen(port);
