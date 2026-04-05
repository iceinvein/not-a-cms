import { registerCommand } from "../router"

registerCommand({
  name: "migrate",
  description: "Run database migrations",
  async run(args) {
    console.log("Running migrations...")
    console.log("(Not yet implemented)")
  },
})
