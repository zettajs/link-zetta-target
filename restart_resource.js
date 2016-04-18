var RestartResource = module.exports = function() {

}

RestartResource.prototype.init = function(config) {
  config
    .path('/restart')
    .del('/', this.restart);
};

RestartResource.prototype.restart = function(env, next) {
  setImmediate(function() {
    env.response.statusCode = 204;
    next(env);
  });

  setTimeout(function() {
    process.exit(0);
  }, 1000);
};
