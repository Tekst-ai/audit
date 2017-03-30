import "source-map-support/register";
import * as uuid from "uuid";

import getPgPool from "../../persistence/pg";
import getEs from "../../persistence/elasticsearch";

const pgPool = getPgPool();
const es = getEs();

interface Opts {
  name: string;
  project_id: string;
};

export default async function createEnvironment(opts: Opts) {
  const environment = {
    id: uuid.v4().replace(/-/g, ""),
    name: opts.name,
    project_id: opts.project_id,
  };

  // Create the ES index
  const alias = `retraced.${environment.project_id}.${environment.id}`;
  const newIndex = `retraced.api.${uuid.v4().replace(/-/g, "")}`;
  const aliases = {};
  aliases[alias] = {};
  const params = {
    index: newIndex,
    body: {
      aliases,
    },
  };

  await es.indices.create(params);

  const q = `insert into environment (
    id, name, project_id
  ) values (
    $1, $2, $3
  )`;
  const v = [
    environment.id,
    environment.name,
    environment.project_id,
  ];
  await pgPool.query(q, v);

  return environment;
}
