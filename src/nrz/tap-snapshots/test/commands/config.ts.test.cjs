/* IMPORTANT
 * This snapshot file is auto-generated, but designed for humans.
 * It should be checked into source control and tracked carefully.
 * Re-generate by setting TAP_SNAPSHOT=1 and running tests.
 * Make sure to inspect the output below.  Do not ignore changes!
 */
'use strict'
exports[`test/commands/config.ts > TAP > usage 1`] = `
Usage:
  nrz config <command> [flags]

Work with nrz configuration

  Aliases

    ​conf

  Subcommands

    get
      Print the named config value

      ​nrz config get <key> [<key> ...]

    list
      Print all configuration settings currently in effect

      ​nrz config list

    set
      Set config values. By default, these are written to the project config
      file, \`nrz.json\` in the root of the project. To set things for all
      projects, run with \`--config=user\`

      ​nrz config set <key>=<value> [<key>=<value> ...] [--config=<user |
      project>]

    del
      Delete the named config fields. If no values remain in the config file,
      delete the file as well. By default, operates on the \`nrz.json\` file in
      the root of the current project. To delete a config field from the user
      config file, specify \`--config=user\`.

      ​nrz config del <key> [<key> ...] [--config=<user | project>]

    edit
      Edit the configuration file

      ​nrz config edit [--config=<user | project>]

    help
      Get information about a config field, or show a list of known config field
      names.

      ​nrz config help [field ...]

`
