#!/usr/bin/env bun
import { runCLI } from "./router"

// Import all commands to register them
import "./commands/init"
import "./commands/dev"
import "./commands/generate"
import "./commands/migrate"
import "./commands/build"
import "./commands/import"
import "./commands/export"

runCLI(Bun.argv)
