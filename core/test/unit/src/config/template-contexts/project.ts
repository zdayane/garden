/*
 * Copyright (C) 2018-2021 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { expect } from "chai"
import stripAnsi = require("strip-ansi")
import { ConfigContext } from "../../../../../src/config/template-contexts/base"
import { ProjectConfigContext } from "../../../../../src/config/template-contexts/project"
import { resolveTemplateString } from "../../../../../src/template-string/template-string"

type TestValue = string | ConfigContext | TestValues | TestValueFunction
type TestValueFunction = () => TestValue | Promise<TestValue>
interface TestValues {
  [key: string]: TestValue
}

describe("ProjectConfigContext", () => {
  it("should resolve local env variables", () => {
    process.env.TEST_VARIABLE = "value"
    const c = new ProjectConfigContext({
      projectName: "some-project",
      projectRoot: "/tmp",
      artifactsPath: "/tmp",
      branch: "main",
      username: "some-user",
      loggedIn: true,
      secrets: {},
      commandInfo: { name: "test", args: {}, opts: {} },
    })
    expect(c.resolve({ key: ["local", "env", "TEST_VARIABLE"], nodePath: [], opts: {} })).to.eql({
      resolved: "value",
    })
    delete process.env.TEST_VARIABLE
  })

  it("should resolve the current git branch", () => {
    const c = new ProjectConfigContext({
      projectName: "some-project",
      projectRoot: "/tmp",
      artifactsPath: "/tmp",
      branch: "main",
      username: "some-user",
      loggedIn: true,
      secrets: {},
      commandInfo: { name: "test", args: {}, opts: {} },
    })
    expect(c.resolve({ key: ["git", "branch"], nodePath: [], opts: {} })).to.eql({
      resolved: "main",
    })
  })

  it("should resolve when logged in", () => {
    const c = new ProjectConfigContext({
      projectName: "some-project",
      projectRoot: "/tmp",
      artifactsPath: "/tmp",
      branch: "main",
      username: "some-user",
      loggedIn: true,
      secrets: { foo: "banana" },
      commandInfo: { name: "test", args: {}, opts: {} },
    })
    expect(c.resolve({ key: ["secrets", "foo"], nodePath: [], opts: {} })).to.eql({
      resolved: "banana",
    })
  })

  context("errors thrown when a missing secret is referenced", () => {
    it("should ask the user to log in if they're logged out", () => {
      const c = new ProjectConfigContext({
        projectName: "some-project",
        projectRoot: "/tmp",
        artifactsPath: "/tmp",
        branch: "main",
        username: "some-user",
        loggedIn: false, // <-----
        secrets: { foo: "banana" },
        commandInfo: { name: "test", args: {}, opts: {} },
      })

      const { message } = c.resolve({ key: ["secrets", "bar"], nodePath: [], opts: {} })

      expect(stripAnsi(message!)).to.match(/Please log in via the garden login command to use Garden with secrets/)
    })

    context("when logged in", () => {
      it("should notify the user if an empty set of secrets was returned by the backend", () => {
        const c = new ProjectConfigContext({
          projectName: "some-project",
          projectRoot: "/tmp",
          artifactsPath: "/tmp",
          branch: "main",
          username: "some-user",
          loggedIn: true,
          secrets: {}, // <-----
          commandInfo: { name: "test", args: {}, opts: {} },
        })

        const { message } = c.resolve({ key: ["secrets", "bar"], nodePath: [], opts: {} })

        expect(stripAnsi(message!)).to.match(/An empty set of secrets was fetched/)
      })

      it("if a non-empty set of secrets was returned by the backend, provide a helpful suggestion", () => {
        const c = new ProjectConfigContext({
          projectName: "some-project",
          projectRoot: "/tmp",
          artifactsPath: "/tmp",
          branch: "main",
          username: "some-user",
          loggedIn: true,
          secrets: { foo: "banana " }, // <-----
          commandInfo: { name: "test", args: {}, opts: {} },
        })

        const { message } = c.resolve({ key: ["secrets", "bar"], nodePath: [], opts: {} })

        expect(stripAnsi(message!)).to.match(/Please make sure that all required secrets have been created/)
      })
    })
  })

  it("should return helpful message when resolving missing env variable", () => {
    const c = new ProjectConfigContext({
      projectName: "some-project",
      projectRoot: "/tmp",
      artifactsPath: "/tmp",
      branch: "main",
      username: "some-user",
      loggedIn: true,
      secrets: {},
      commandInfo: { name: "test", args: {}, opts: {} },
    })
    const key = "fiaogsyecgbsjyawecygaewbxrbxajyrgew"

    const { message } = c.resolve({ key: ["local", "env", key], nodePath: [], opts: {} })

    expect(stripAnsi(message!)).to.match(
      /Could not find key fiaogsyecgbsjyawecygaewbxrbxajyrgew under local.env. Available keys: /
    )
  })

  it("should resolve the local platform", () => {
    const c = new ProjectConfigContext({
      projectName: "some-project",
      projectRoot: "/tmp",
      artifactsPath: "/tmp",
      branch: "main",
      username: "some-user",
      loggedIn: true,
      secrets: {},
      commandInfo: { name: "test", args: {}, opts: {} },
    })
    expect(c.resolve({ key: ["local", "platform"], nodePath: [], opts: {} })).to.eql({
      resolved: process.platform,
    })
  })

  it("should resolve the local username (both regular and lower case versions)", () => {
    const c = new ProjectConfigContext({
      projectName: "some-project",
      projectRoot: "/tmp",
      artifactsPath: "/tmp",
      branch: "main",
      username: "SomeUser",
      loggedIn: true,
      secrets: {},
      commandInfo: { name: "test", args: {}, opts: {} },
    })
    expect(c.resolve({ key: ["local", "username"], nodePath: [], opts: {} })).to.eql({
      resolved: "SomeUser",
    })
    expect(c.resolve({ key: ["local", "usernameLowerCase"], nodePath: [], opts: {} })).to.eql({
      resolved: "someuser",
    })
  })

  it("should resolve the command name", () => {
    const c = new ProjectConfigContext({
      projectName: "some-project",
      projectRoot: "/tmp",
      artifactsPath: "/tmp",
      branch: "main",
      username: "SomeUser",
      loggedIn: true,
      secrets: {},
      commandInfo: { name: "test", args: {}, opts: {} },
    })
    expect(c.resolve({ key: ["command", "name"], nodePath: [], opts: {} })).to.eql({
      resolved: "test",
    })
  })

  it("should resolve command params (positive)", () => {
    const c = new ProjectConfigContext({
      projectName: "some-project",
      projectRoot: "/tmp",
      artifactsPath: "/tmp",
      branch: "main",
      username: "SomeUser",
      loggedIn: true,
      secrets: {},
      commandInfo: { name: "deploy", args: {}, opts: { "hot-reload": ["my-service"] } },
    })

    let result = resolveTemplateString(
      "${command.name == 'deploy' && (command.params.hot-reload contains 'my-service')}",
      c
    )
    expect(result).to.be.true
  })

  it("should resolve command params (negative)", () => {
    const c = new ProjectConfigContext({
      projectName: "some-project",
      projectRoot: "/tmp",
      artifactsPath: "/tmp",
      branch: "main",
      username: "SomeUser",
      loggedIn: true,
      secrets: {},
      commandInfo: { name: "test", args: {}, opts: {} },
    })

    let result = resolveTemplateString(
      "${command.params contains 'hot-reload' && command.params.hot-reload contains 'my-service'}",
      c
    )
    expect(result).to.be.false
  })
})
