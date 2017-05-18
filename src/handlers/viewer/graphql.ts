import "source-map-support/register";
import * as querystring from "querystring";
import { checkViewerAccess } from "../../security/helpers";
import { defaultEventCreater, CreateEventRequest } from "../createEvent";

import handler from "../graphql/handler";

export default async function(req) {
  const claims = await checkViewerAccess(req);
  const thisViewEvent: CreateEventRequest = {
    action: claims.viewLogAction,
    crud: "r",
    actor: {
      id: claims.actorId,
    },
    group: {
      id: claims.groupId,
    },
    description: `${req.method} ${req.originalUrl}`,
    source_ip: claims.ip,
  };

  let targetId;
  if (claims.scope) {
    const scope = querystring.parse(claims.scope);
    targetId = scope.target_id;
    thisViewEvent.target = {
      id: targetId,
    };
  }

  const results = await handler(req, {
    projectId: claims.projectId,
    environmentId: claims.environmentId,
    groupId: claims.groupId,
    targetId,
  });

  await defaultEventCreater.saveRawEvent(
    claims.projectId,
    claims.environmentId,
    thisViewEvent,
  );

  return results;
}
