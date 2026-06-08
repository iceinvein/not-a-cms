type Command = {
  name: string
  description: string
  run: (args: string[]) => Promise<void>
}

const commands: Map<string, Command> = new Map()

export function registerCommand(cmd: Command) {
  commands.set(cmd.name, cmd)
}

export async function runCLI(argv: string[]) {
  // argv[0] = bun, argv[1] = script path, argv[2+] = command + args
  const cmdName = argv[2]
  const args = argv.slice(3)

  if (!cmdName || cmdName === "--help" || cmdName === "-h") {
    printHelp()
    return
  }

  const cmd = commands.get(cmdName)
  if (!cmd) {
    console.error(`Unknown command: ${cmdName}`)
    console.error(`Run 'not-a-cms --help' for available commands`)
    process.exit(1)
  }

  await cmd.run(args)
}

function printHelp() {
  console.log(`
  not-a-cms — The modern CMS toolkit

  Usage: not-a-cms <command> [options]

  Commands:`)

  for (const [name, cmd] of commands) {
    console.log(`    ${name.padEnd(20)} ${cmd.description}`)
  }

  console.log(`
    --help, -h          Show this help message
  `)
}

export { type Command, commands }
