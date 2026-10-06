import {loadConfig} from './config.js';
import {PayamGostarClient} from './payamgostar.js';
import {DashboardService} from './dashboard-service.js';
import {createApiServer} from './app.js';
const config=loadConfig();
const server=createApiServer(config,new DashboardService(config,new PayamGostarClient(config)));
server.listen(config.port,config.host,()=>console.log(`Farin read API listening on ${config.host}:${config.port}; credentials are not logged.`));
function shutdown(){server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),10000).unref();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
