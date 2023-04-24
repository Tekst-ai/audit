import url from "url";
import express from "express";
import cors from "cors";
import _ from "lodash";
import Sigsci from "sigsci-module-nodejs";
import swaggerUI from "swagger-ui-express";
import config from "./config";
import { register, wrapRoute } from "./router";
import { LegacyRoutes } from "./routes";
// import { RegisterRoutes } from "./gen/routes";
import { AdminUserBootstrap } from "./handlers/admin/AdminUserBootstrap";
import { ensureHeadlessProject } from "./headless";
import "./metrics";
import swaggerSpecs from "./swagger";
import getPgPool from "./persistence/pg";

import "./controllers/PublisherController";
import "./controllers/AdminController";
import "./controllers/EnterpriseController";
import { logger } from "./logger";

const app = express();
const router = express.Router();

let basePath = "";
if (config.API_BASE_URL_PATH) {
  basePath = url.parse(config.API_BASE_URL_PATH || "").pathname || "";
}
logger.info(`listening on basePath ${basePath}`);

// Sigsci middleware has to be installed before routes and other middleware
if (!config.SIGSCI_RPC_ADDRESS) {
  logger.error("SIGSCI_RPC_ADDRESS not set, Signal Sciences module will not be installed");
} else {
  const sigsci = new Sigsci({
    path: config.SIGSCI_RPC_ADDRESS,
  });
  app.use(sigsci.express());
}

app.set("etag", false); // we're doing our own etag thing I guess
// The nearest ip address in the X-Forwarded-For header not in a private
// subnet will be used as req.ip.
app.set("trust proxy", "uniquelocal");


app.use(express.json({ limit: "10mb" }));
app.use(cors());

buildRoutes();

function buildRoutes() {
  registerHealthchecks();

  swaggerSpecs.forEach((spec) => {
    logger.debug(`GET    '${spec.path}/swagger.json'`);
    logger.debug(`GET    '${spec.path}/swagger'`);
    router.get(`${spec.path}/swagger.json`, (req, res) => {
      res.setHeader("ContentType", "application/json");
      res.send(spec.swagger);
    });
    router.use(`${spec.path}/swagger`, swaggerUI.serve, swaggerUI.setup(spec.swagger));
  });

  RegisterRoutes(router);

  _.forOwn(LegacyRoutes(), (route, handlerName: string) => {
    const handler = wrapRoute(route, handlerName);
    register(route, handler, router);
  });

  if (config.ADMIN_ROOT_TOKEN) {
    const route = { method: "post", path: "/admin/v1/user/_login" };
    const handler = wrapRoute({ handler: AdminUserBootstrap.default().handler() }, "_login");
    register(route, handler, router);
  }

  app.use(basePath, router);

  app.use((req, res) => {
    const errMsg = "Not Found";
    logger.error(`[${req.ip}] ${req.path} ${errMsg}`);
    res.status(404).send(errMsg);
  });
}

export function registerHealthchecks() {
  // Needed for Kubernetes health checks
  app.get("/", (req, res) => {
    // trying a slight delay to keep sigsci from freaking out
    setTimeout(() => res.send(""), 200);
  });
  app.get(`${basePath}/`, (req, res) => {
    // trying a slight delay to keep sigsci from freaking out
    setTimeout(() => res.send(""), 200);
  });

  // Needed for Kubernetes health checks
  app.get("/healthz", (req, res) => {
    // trying a slight delay to keep sigsci from freaking out
    setTimeout(() => res.send(""), 200);
  });

  // Needed for Kubernetes health checks
  app.get("/metricz", (req, res) => {
    setTimeout(() => res.send("{}"), 200);
  });
}



function serveHTTP() {
  app.listen(3000, "0.0.0.0", () => {
    logger.info("Retraced API listening on port 3000...");
  });
}

ensureHeadlessProject();

process.on("SIGTERM", async () => {
  logger.info("Got SIGTERM. Graceful shutdown start", new Date().toISOString());
  logger.info("draining postgres pool");
  await getPgPool().end();
  logger.info("postgres pool drained");
  process.exit(137);
});
