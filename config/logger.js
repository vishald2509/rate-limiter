const bunyan = require("bunyan");



const InitLogger = (fileName) => {
  const logger = bunyan.createLogger({
    name: fileName,
    env: process.env.NODE_ENV,
    serializers: bunyan.stdSerializers,
    src: true,
    level: process.env.NODE_ENV == "production" ? "info" : "debug",
  });

  return logger;
};

module.exports = InitLogger;
