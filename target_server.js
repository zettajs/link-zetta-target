var zetta = require('zetta');
var MemoryRegistries = require('zetta-memory-registry')(zetta);
var PeerRegistry = MemoryRegistries.PeerRegistry;
var DeviceRegistry = MemoryRegistries.DeviceRegistry;
var DeviceDataSqs = require('zetta-device-data-sqs');
var UsageApp = require('zetta-usage-addon');
var UsageCollector = require('./sqs_collector');
var MqttScout = require('./mqtt/scout');

var port = process.env.MAPPED_PORT || 3001;
var version = process.env.VERSION || '0';

var instance = zetta({
  registry: new DeviceRegistry(),
  peerRegistry: new PeerRegistry()
});

instance.name('cloud-devices');

// MQTT is enabled only if there is a broker URL
if (process.env.MQTT_BROKER_URL && process.env.MQTT_BROKER_URL.indexOf('@@') !== 0) {
  console.log('Enabling MQTT scout to broker ', process.env.MQTT_BROKER_URL);
  instance.use(MqttScout, { clientId: (process.env.COREOS_PRIVATE_IPV4 || 'localhost') + ':' + port,
                            url: process.env.MQTT_BROKER_URL,
                            destroyTimeout: process.env.MQTT_DESTROY_TIMEOUT || 300000
                          });
}

if (process.env.DEVICE_DATA_QUEUE) {
  var sqs = new DeviceDataSqs({
    queueUrl: process.env.DEVICE_DATA_QUEUE,
    accessKeyId: process.env.AWS_ACCESSKEY,
    secretAccessKey: process.env.AWS_SECRET
  });
  instance.use(sqs.collect());
}

if (process.env.USAGE_QUEUE) {
  var app = new UsageApp()
  instance.use(app.collect());
  var opts = {
    queueUrl: process.env.USAGE_QUEUE,
    accessKeyId: process.env.AWS_ACCESSKEY,
    secretAccessKey: process.env.AWS_SECRET,
    emitter: app
  }
  UsageCollector(opts);
}

instance.listen(port);


