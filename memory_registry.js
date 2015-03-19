var util = require('util');
var levelup = require('levelup');
var memdown = require('memdown');
var Registry = require('zetta/lib/registry');

var MemRegistry = module.exports = function() {
    var db = levelup({ db: memdown });
      Registry.call(this, { db: db, collection: 'devices' });
}
util.inherits(MemRegistry, Registry);
