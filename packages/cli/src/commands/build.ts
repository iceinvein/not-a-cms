import { registerCommand } from "../router"

registerCommand({
  name: "build",
  description: "Build for production",
  async run(args) {
    console.log("Building for production...")
    console.log("(Not yet implemented)")
  },
})
