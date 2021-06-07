/*
 * Copyright (C) 2018-2021 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { WorkflowConfig, makeRunConfig } from "../config/workflow"
import { LogEntry } from "../logger/log-entry"
import { EnterpriseApiError } from "../exceptions"
import { gardenEnv } from "../constants"
import { Garden } from "../garden"
import { ApiFetchResponse, isGotError } from "./api"
import { RegisterWorkflowRunResponse } from "@garden-io/platform-api-types"
import { deline } from "../util/string"

export interface RegisterWorkflowRunParams {
  workflowConfig: WorkflowConfig
  garden: Garden
  environment: string
  namespace: string
  log: LogEntry
}

/**
 * Registers the workflow run with the platform, and returns the UID generated for the run.
 */
export async function registerWorkflowRun({
  garden,
  workflowConfig,
  environment,
  namespace,
  log,
}: RegisterWorkflowRunParams): Promise<string> {
  log.debug(`Registering workflow run for ${workflowConfig.name}...`)
  const { enterpriseApi, projectId } = garden
  const workflowRunConfig = makeRunConfig(workflowConfig, environment, namespace)
  const requestData = {
    projectUid: projectId,
    workflowRunConfig,
  }
  if (gardenEnv.GARDEN_GE_SCHEDULED) {
    requestData["workflowRunUid"] = gardenEnv.GARDEN_WORKFLOW_RUN_UID
  }
  if (enterpriseApi) {
    // TODO: Use API types package here.
    let res: ApiFetchResponse<RegisterWorkflowRunResponse>
    try {
      res = await enterpriseApi.post("workflow-runs", {
        body: requestData,
        retry: true,
        retryDescription: "Registering workflow run",
      })
    } catch (err) {
      if (isGotError(err, 422)) {
        const errMsg = deline`
          Workflow run registration failed due to mismatch between CLI and API versions. Please make sure your Garden
          CLI version is compatible with your version of Garden Enterprise. See error.log for details
          on the failed registration request payload.
        `
        throw new EnterpriseApiError(errMsg, {
          requestData,
        })
      } else {
        log.error(`An error occurred while registering workflow run: ${err.message}`)
        throw err
      }
    }

    if (res?.workflowRunUid && res?.status === "success") {
      return res.workflowRunUid
    } else {
      throw new EnterpriseApiError(`Error while registering workflow run: Request failed with status ${res?.status}`, {
        status: res?.status,
        workflowRunUid: res?.workflowRunUid,
      })
    }
  }
  throw new EnterpriseApiError("Error while registering workflow run: Couldn't initialize API.", {})
}
