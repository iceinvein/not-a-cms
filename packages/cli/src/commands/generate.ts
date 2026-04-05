import { registerCommand } from "../router"

registerCommand({
  name: "generate",
  description: "Generate types and migrations",
  async run(args) {
    const subcommand = args[0]
    if (subcommand === "types") {
      console.log("Generating TypeScript types from schema...")
      console.log("(Not yet implemented)")
    } else if (subcommand === "migration") {
      console.log("Generating migration from schema changes...")
      console.log("(Not yet implemented)")
    } else {
      console.log("Usage: not-a-cms generate <types|migration>")
    }
  },
})
