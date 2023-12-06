const Redis = require("ioredis");
const NodeCache = require("./nodeCache");

const logger = console;

class DatabaseConnection {
  dbConnection = null;
  config = {};
  database = null;
  constructor(config) {
    logger.debug(`file: redisConnection, method: constructor, message: constructor start ${JSON.stringify(config)}`);

    if (config && config instanceof Object) this.config = config;
    const { clusterMode = true, database, credentials, clusterOptions = { enableReadyCheck: true } } = this.config;
    this.database = database;
    let client = null;
    if(database === "redis") {     
        if(JSON.parse(clusterMode)) {
          if (!Array.isArray(credentials) || !credentials.length) throw new Error("file: redisConnection, method: constructor, error: Missing connection configuration");
          client = new Redis.Cluster(credentials, clusterOptions);
        } else {       
          client = new Redis(credentials);      
        }
        this.attachListiner(client);
    } else if(database === "nodecache") {       
        client = NodeCache();
    }

    this.dbConnection = client || null;
    logger.debug("file: redisConnection, method: constructor, message: constructor return");
  }

  onError(cb) {
    if (cb && this.dbConnection && this.database === "redis") this.dbConnection.on("error", cb);
  }

  onReconnect(cb) {
    if (cb && this.dbConnection && this.database === "redis") this.dbConnection.on("reconnecting", cb);
  }

  checkReadyState(rejectOnError) {
    return new Promise(async (resolve,reject)=>{
      if (this.dbConnection){
        
        if(this.database === "nodecache") {
            if(this.dbConnection.status === "ready") return resolve(this.databaseConnection);
        }

        function handleReady(){
          logger.info("file: redisConnection, method: handelReady, message: redis ready");
          this.removeListener("ready", handleReady);
          resolve();
        };

        function handleError(e){
          this.removeListener("error", handleError);
          reject(e);
        };

        if(this.dbConnection.status == "ready")
          resolve();
        else{
          this.dbConnection.on("ready", handleReady);
          if(rejectOnError)
            this.dbConnection.on("error", handleError);
        }
      }
      else reject(new Error("redis connection not present"));
    });
  }

  attachListiner(dbConnection) {
    if(this.database === "nodecache") return;
    // Logging for debug prespective
    dbConnection
      .on("connect", () => {
        logger.debug("file: redisConnection, method: onConnect, message: Redis connect");
      })
      .on("ready", () => {
        logger.debug("file: redisConnection, method: onReady, message: Redis ready");
      })
      .on("error", e => {
        logger.debug(`file: redisConnection, method: onError, error: redis error ${e.message || "Uncaught Error"}`);
      })
      .on("reconnecting", () => {
        logger.debug("file: redisConnection, method: onReconnecting, message: redis reconnecting");
      })
      .on("end", ()=>{
        logger.debug("file: redisConnection, method: onReconnecting, message: redis end");
      });
  }

  getDbConnection() {
    return this.dbConnection || null;
  }

  disconnect() {
    if (!this.dbConnection) {
      throw new Error("file: redisConnection, method: disconnect, error: no redis connection");      
    }
    this.dbConnection.disconnect();
  }
}

module.exports = DatabaseConnection;
